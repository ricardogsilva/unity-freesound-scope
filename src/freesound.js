// TODO:
//
// * add sample comments in the preview
//
// GENERAL REMARKS ON MISSING OR INCORRECT FUNCTIONALITY:
//
// There are some bugs in the javascript bindings that are currently
// available on the phone on the stable channels, namely:
//
// * Online accounts are totally broken (seems this was fixed already but not
//   published yet) and therefore we are not shipping manifest files for
//   enabling them nor instnatiating them here
//
// * PreviewWidgets whose add_attribute_value() method is supposed to accept
//   an array of objects do not work as documented. Instead they only accept
//   a single object, thus negating the possibility of adding multiple entries.
//   This is the case for PreviewWidget of types:
//
//   * audio,
//   * actions,
//   * table,
//
// * PreviewWidgets of type expandable do not work if they contain more than
//   one widget, which defeats the whole purpose of them being expandable in
//   the first place
//
// * PreviewWidgets of type review do not show up at all in the phone, while
//   they work just fine on the desktop


var scopes = require('unity-js-scopes')
var http = require('http');
var url = require('url');
var EventEmitter = require('events');
var util = require('util');

var FREESOUND_HOST = "www.freesound.org";
var TEXT_SEARCH_PATH = '/apiv2/search/text/';
var FREESOUND_API_KEY = "29001a76da1a12269b17637541b56f07af1cdda2";

// Fields returned by the freesound API for each sample
// For more info check the API docs at:
// http://freesound.org/docs/api/resources_apiv2.html#sound-resources
var SOUND_INSTANCE_FIELDS = [
    "id",
    "url",
    "name",
    "license",
    "tags",
    "pack",
    "description",
    "created",
    "duration",
    "download",
    "previews",
    "images",
    "username",
].toString();

// A curated selection of the most used tags on Freesound.org
var TAGS = [
    "ambience", "atmosphere",
    "bass", "beat", "birds",
    "city", "car",
    "door", "drum",
    "electronic",
    "female", "field-recording", "foley",
    "guitar",
    "hit", "horror",
    "loop",
    "machine", "music",
    "nature", "noise",
    "synth",
    "techno", "thunder", "traffic",
    "voice",
    "water", "weird", "wind",
];

var AVAILABLE_PAGE_SIZES = {
    0: 3,
    1: 15,
    2: 30,
    3: 45
};


var CategoryRenderer = function(search_reply, page_size) {
    var self = this;
    EventEmitter.call(self);

    var newest_renderer = new scopes.lib.CategoryRenderer(
        JSON.stringify({
            "schema-version": 1,
            "template": {
                "category-layout": "grid",
                "card-layout": "horizontal",
                "card-size": "large",
                "quick-preview-type": "audio",
            },
            "components": {
                "title": "title",
                "art": {
                    "field": "art"
                },
                "subtitle": "description",
                "quick-preview-data": {
                    "field": "quick_preview",
                }
            }
        })
    );

    var nearby_renderer = new scopes.lib.CategoryRenderer(
        JSON.stringify({
            "schema-version": 1,
            "template": {
                "category-layout": "grid",
                "card-layout": "horizontal",
                "card-size": "small",
                "quick-preview-type": "audio",
            },
            "components": {
                "title": "title",
                "art": {
                    "field": "art"
                },
                "subtitle": "description",
                "quick-preview-data": {
                    "field": "quick_preview",
                }
            }
        })
    );

    var most_downloaded_renderer = new scopes.lib.CategoryRenderer(
        JSON.stringify({
            "schema-version": 1,
            "template": {
                "category-layout": "grid",
                "card-layout": "horizontal",
                "card-size": "small",
                "quick-preview-type": "audio",
            },
            "components": {
                "title": "title",
                "art": {
                    "field": "art"
                },
                "subtitle": "description",
                "quick-preview-data": {
                    "field": "quick_preview",
                }
            }
        })
    );

    self.search_reply = search_reply;
    self.page_size = page_size;
    self.location_enabled = false;

    // categories only show up in the scopes GUI after we push results to them
    self.categories = {
        "newest": search_reply.register_category("newest", "Newest sounds",
                                                 "", newest_renderer),
        "nearby": search_reply.register_category("nearby", "Nearby sounds",
                                                 "", nearby_renderer),
        "most_downloaded": search_reply.register_category("most_downloaded",
                                                          "Most downloaded sounds",
                                                          "",
                                                          most_downloaded_renderer),
    }

    // buffer incoming results so that we can ensure the correct order of display
    self.most_downloaded_buffer = [];
    self.nearby_buffer = [];
    // GUI order:
    // 1. newest
    // 2. most_downloaded
    // 3. nearby (becomes disabled if the user does not enable location data)
    self.next_gui_category = "newest";
    self.number_of_newest = null;
    self.number_of_nearby = null;
    self.number_of_most_downloaded = null;
    self.rendered_newest = 0;
    self.rendered_nearby = 0;
    self.rendered_most_downloaded = 0;
}
util.inherits(CategoryRenderer, EventEmitter);


CategoryRenderer.prototype.render_result = function(result, category_id) {
    var self = this;
    var categorised_result = new scopes.lib.CategorisedResult(self.categories[category_id]);
    categorised_result.set_uri(result.id.toString());
    categorised_result.set_title(result.name);
    categorised_result.set('url', result.url);
    categorised_result.set('download', result.download);
    categorised_result.set('username', result.username);
    categorised_result.set('description', result.description);
    categorised_result.set('art', result.images.waveform_l);
    //categorised_result.set('audio_preview', result.previews["preview-lq-mp3"]);
    categorised_result.set(
        'quick_preview',
        {
            "uri": result.previews["preview-lq-mp3"],
            "duration": result.duration
        }
    );
    categorised_result.set('tags', result.tags);
    categorised_result.set('created', result.created);
    categorised_result.set('license', result.license);
    categorised_result.set('pack', result.pack);
    categorised_result.set('all', result);

    // these if blocks of code deal with buffering incoming results
    // in order to ensure a consistent ordering of categories in the GUI
    if (category_id === "newest") {
        self.search_reply.push(categorised_result);
        self.rendered_newest += 1;
        if (self.next_gui_category === "newest") {
            self.next_gui_category = "most_downloaded";
            self.most_downloaded_buffer.forEach(function(item, index, array) {
                self.search_reply.push(item);
                self.rendered_most_downloaded += 1;
            });
            if (self.most_downloaded_buffer.length > 0) {
                self.nearby_buffer.forEach(function(item, index, array) {
                    self.search_reply.push(item);
                    self.rendered_nearby += 1;
                });
                self.nearby_buffer = [];
            }
            self.most_downloaded_buffer = [];
        }
    }
    else if (category_id === "most_downloaded") {
        if (self.next_gui_category === "newest") {
            self.most_downloaded_buffer.push(categorised_result)
        } else {
            self.search_reply.push(categorised_result);
            self.rendered_most_downloaded += 1;
            if (self.next_gui_category === "most_downloaded") {
                self.next_gui_category = "nearby";
                self.nearby_buffer.forEach(function(item, index, array) {
                    self.search_reply.push(item);
                    self.rendered_nearby += 1;
                });
                self.nearby_buffer = [];
            }
        }
    }
    else if (category_id === "nearby") {
        if (self.next_gui_category !== "nearby") {
            self.nearby_buffer.push(categorised_result);
        } else {
            self.search_reply.push(categorised_result);
            self.rendered_nearby += 1;
        }
    }
    self.emit("renderedResult");
}


CategoryRenderer.prototype.retrieve_newest_sounds = function(canned_query, metadata) {
    var self = this;
    var search_callback = function(response) {
        var res = "";
        response.on("data", function(chunk) {
            res += chunk;
        });
        response.on("end", function() {
            var r = JSON.parse(res);
            self.number_of_newest = r.results.length
            r.results.forEach(function(item, index, array) {
                self.render_result(item, "newest");
            });
        });
    };
    var active_department = canned_query.department_id();
    var query_filter = "";

    if (active_department !== "") {
        query_filter += " tag:" + active_department;
    };
    var request_url = build_url({
        query_string: canned_query.query_string(),
        page_size: self.page_size,
        sort: "created_desc",
        filter: query_filter,
    });
    http.request(request_url, search_callback).end();
};


CategoryRenderer.prototype.retrieve_nearby_sounds = function(canned_query, location) {
    var self = this;
    var search_callback = function(response) {
        var res = "";
        response.on("data", function(chunk) {
            res += chunk;
        });
        response.on("end", function() {
            var r = JSON.parse(res);
            self.number_of_nearby = r.results.length
            r.results.forEach(function(item, index, array) {
                self.render_result(item, "nearby");
            });
        });
    };

    var lat = location.latitude();
    var lon = location.longitude();
    // TODO: try to get the city's name from the location info and
    // use it as a search keyword in order to also get back results
    // that are not geotagged.
    var radius = scopes.self.settings["nearbyRadius"].get_double();

    var active_department = canned_query.department_id();
    var query_filter = "{!geofilt sfield=geotag pt=" + lat + "," + lon + " d=" + radius + "}";
    if (active_department !== "") {
        query_filter += " tag:" + active_department;
    };
    var request_url = build_url({
        query_string: canned_query.query_string(),
        page_size: self.page_size,
        filter: query_filter,
    });
    http.request(request_url, search_callback).end();
};


CategoryRenderer.prototype.retrieve_most_downloaded_sounds = function(canned_query, metadata) {
    var self = this;
    var search_callback = function(response) {
        var res = "";
        response.on("data", function(chunk) {
            res += chunk;
        });
        response.on("end", function() {
            var r = JSON.parse(res);
            self.number_of_most_downloaded = r.results.length
            r.results.forEach(function(item, index, array){
                self.render_result(item, "most_downloaded");
            });
        });
    };

    var active_department = canned_query.department_id();
    var query_filter = "";
    if (active_department !== "") {
        query_filter += " tag:" + active_department;
    };
    var request_url = build_url({
        query_string: canned_query.query_string(),
        page_size: self.page_size,
        sort: "downloads_desc",
        filter: query_filter,
    });
    http.request(request_url, search_callback).end();
};


var build_url = function(options) {
    var page_size = options.page_size || 0;
    var query_string = options.query_string || "";
    var protocol = options.protocol || "http";

    var query = {
        token: FREESOUND_API_KEY,
        fields: SOUND_INSTANCE_FIELDS,
        page_size: page_size,
        query: query_string,
    }
    if (options.filter) {
        query["filter"] = options.filter;
    };
    if (options.sort) {
        query["sort"] = options.sort;
    };
    var request_url = url.format({
        protocol: protocol,
        hostname: FREESOUND_HOST,
        pathname: TEXT_SEARCH_PATH,
        query: query,
    });
    return request_url
};


scopes.self.initialize({}, {
    start: function(scope_id) {
        console.log('Starting scope id: '
                    + scope_id
                    + ', '
                    + scopes.self.scope_directory)
    },

    run: function() {
        console.log('Running...')
    },

    search: function(canned_query, metadata) {
        var run_search_cb = function(search_reply) {
            console.log("is_aggregated: " + metadata.is_aggregated());
            console.log("aggregated_keywords: " + metadata.aggregated_keywords());


            var page_size_setting = scopes.self.settings["resultsPerCategory"].get_int();
            var page_size = AVAILABLE_PAGE_SIZES[page_size_setting];

            var freesound_searcher = new CategoryRenderer(search_reply, page_size);
            freesound_searcher.on("renderedResult", function() {
                var self = this;
                if (self.rendered_newest === self.number_of_newest) {
                    console.log("all newest have been rendered");
                    if (self.rendered_most_downloaded === self.number_of_most_downloaded) {
                        console.log("all most_downloaded have been rendered");
                        if (self.location_enabled) {
                            if (self.rendered_nearby === self.number_of_nearby) {
                                console.log("all nearby have been rendered (or there are none)");
                                self.search_reply.finished();
                            }
                        } else {  // location disabled by the user
                            self.search_reply.finished();
                        }
                    }
                }
            })
            var location = undefined;
            if (metadata.has_location()) {
                location = metadata.location();
                freesound_searcher.location_enabled = true;
            }

            if (metadata.is_aggregated()) {
                var keywords = metadata.aggregated_keywords();
                if (keywords.indexOf("nearby.howdoyoufeel") !== -1) {
                    if (freesound_searcher.location_enabled) {
                        freesound_searcher.retrieve_nearby_sounds(canned_query, location);
                    }
                } else if (keywords.indexOf("audio") !== -1) {
                    freesound_searcher.retrieve_most_downloaded_sounds(canned_query, metadata);
                }

            } else {
                // normal search, we are not being used by an aggregator scope
                var root_department = new scopes.lib.Department("", canned_query,
                                                                "All samples");
                TAGS.forEach(function(item, index, array) {
                    var sub_department = new scopes.lib.Department(item, canned_query, item);
                    root_department.add_subdepartment(sub_department);
                });
                search_reply.register_departments(root_department);
                freesound_searcher.retrieve_newest_sounds(canned_query, metadata);
                freesound_searcher.retrieve_most_downloaded_sounds(canned_query, metadata);
                if (freesound_searcher.location_enabled) {
                    freesound_searcher.retrieve_nearby_sounds(canned_query, location);
                }
            }
        };

        var cancel_search_cb = function() {};

        return new scopes.lib.SearchQuery(canned_query, metadata,
                                          run_search_cb, cancel_search_cb);
    },

    preview: function(result, action_metadata) {
        var run_preview_cb = function(preview_reply) {
            // layout definition for a screen with only one column
            var layout_1_col = new scopes.lib.ColumnLayout(1);
            layout_1_col.add_column([
                "image_id",
                "header_id",
                "audio_id",
                "actions_id",
                "description_id",
                //"license_id",
            ]);

            // layout definition for a screen with two columns
            var layout_2_col = new scopes.lib.ColumnLayout(2);
            layout_2_col.add_column([
                "image_id",
                "header_id",
                "audio_id",
                "actions_id",
                "description_id",
                //"license_id",
            ]);
            layout_2_col.add_column([]);

            // layout definition for a screen with three columns
            var layout_3_col = new scopes.lib.ColumnLayout(3);
            layout_3_col.add_column([
                "image_id",
                "header_id",
                "audio_id",
                "actions_id",
                "description_id",
                //"license_id",
            ]);
            layout_3_col.add_column([]);
            layout_3_col.add_column([]);

            preview_reply.register_layout([layout_1_col,
                                           layout_2_col,
                                           layout_3_col]);

            var image_widget = new scopes.lib.PreviewWidget("image_id", "image");
            image_widget.add_attribute_mapping("source", "art");

            var header_widget = new scopes.lib.PreviewWidget("header_id", "header");
            header_widget.add_attribute_mapping("title", "title")
            header_widget.add_attribute_value("subtitle", "👤" + result.get("username"))

            var description_widget = new scopes.lib.PreviewWidget("description_id",
                                                           "text");
            description_widget.add_attribute_value("title", "Details");

            var description_text = "Created: " +
                new Date(result.get("created")).toDateString() +
                "\n\n" + result.get("description") +
                "\n\nLicense: " + result.get("license");
            //description_widget.add_attribute_mapping("text", "description");
            description_widget.add_attribute_value("text", description_text);

            var audio_widget = new scopes.lib.PreviewWidget("audio_id", "audio");
            // TODO: refactor this once the bug with add_attribute_value with
            // an array has been fixed and published
            audio_widget.add_attribute_value(
                "tracks",
                {
                     "title": result.get("title"),
                     "source": result.get("quick_preview")["uri"],
                     "length": Math.floor(result.get("quick_preview")["duration"]),
                }
            );

            var actions_widget = new scopes.lib.PreviewWidget("actions_id",
                                                              "actions");

            // TODO: refactor this once the bug with add_attribute_value with
            // an array has been fixed and published
            actions_widget.add_attribute_value("actions",
                {
                    "id": "open",
                    "label": "Open",
                    "uri": result.get("url"),
                }
            );

            var license_widget = new scopes.lib.PreviewWidget("license_id", "text");
            license_widget.add_attribute_value("title", "License");
            license_widget.add_attribute_value("text", result.get("license"));

            preview_reply.push([
                image_widget,
                header_widget,
                audio_widget,
                description_widget,
                actions_widget,
                //license_widget,
            ]);
            preview_reply.finished();
        };
        var cancel_preview_cb = function() {};
        return new scopes.lib.PreviewQuery(result, action_metadata,
                                           run_preview_cb,
                                           cancel_preview_cb);

    },
    perform_action: function(result, metadata, widget_id, action_id) {
        console.log("perform_action called");
        console.log("result:");
        for (item in result) {
            console.log("\t" + item + ": " + result[item]);
        }
        console.log("metadata:");
        for (item in metadata) {
            console.log("\t" + item + ": " + metadata[item]);
        }
        console.log("widget_id: " + widget_id);
        console.log("action_id: " + action_id);
    },

    stop: function() {
        console.log('Stopping...')
    }

});
