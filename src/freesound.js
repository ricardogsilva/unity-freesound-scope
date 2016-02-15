var scopes = require('unity-js-scopes')
var http = require('http');
var url = require('url');

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
    "license",  // maybe this is not needed
    "description",
    "created",
    "duration",
    "download",
    "previews",
    "images",
    "avg_rating",
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

var NEWEST_SOUNDS_CATEGORY_DEFINITION = {
    "schema-version": 1,
    "template": {
        "category-layout": "grid",
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
            "field": "audio_preview",
        }
    }
};

var MOST_DOWNLOADED_CATEGORY_DEFINITION = {
    "schema-version": 1,
    "template": {
        "category-layout": "grid",
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
            "field": "audio_preview",
        }
    }
};

var NEARBY_SOUNDS_CATEGORY_DEFINITION = {
    "schema-version": 1,
    "template": {
        "category-layout": "grid",
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
            "field": "audio_preview",
        }
    }
};

var CategoryRenderer = function(search_reply, page_size, active_department) {
    var self = this;
    var newest_renderer = new scopes.lib.CategoryRenderer(JSON.stringify(NEWEST_SOUNDS_CATEGORY_DEFINITION));
    var nearby_renderer = new scopes.lib.CategoryRenderer(JSON.stringify(NEARBY_SOUNDS_CATEGORY_DEFINITION));
    var most_downloaded_renderer = new scopes.lib.CategoryRenderer(JSON.stringify(MOST_DOWNLOADED_CATEGORY_DEFINITION));

    self.search_reply = search_reply;
    self.page_size = page_size;
    self.active_department = active_department;

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
    self.buffer = [];
}

CategoryRenderer.prototype.render_result = function(result, category_id) {
    var self = this;
    var categorised_result = new scopes.lib.CategorisedResult(self.categories[category_id]);
    categorised_result.set_uri(result.id.toString());
    categorised_result.set_title(result.name);
    categorised_result.set('license', result.license);
    categorised_result.set('description', result.description);
    categorised_result.set('art', result.images.waveform_l);
    categorised_result.set('audio_preview', result.previews["preview-lq-mp3"]);
    categorised_result.set('all', result);
    self.search_reply.push(categorised_result);
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
            //console.log(r);
            r.results.forEach(function(item, index, array) {
                self.render_result(item, "newest");
            });
        });
    };
    var query_filter = "";
    if (self.active_department !== "") {
        query_filter += " tag:" + self.active_department;
    };
    var request_url = build_url({
        query_string: canned_query.query_string(),
        page_size: self.page_size,
        sort: "created_desc",
        filter: query_filter,
    });
    console.log("retreive_newest_sounds generated URL: " + request_url);
    http.request(request_url, search_callback).end();
};

CategoryRenderer.prototype.retrieve_nearby_sounds = function(canned_query, metadata) {
    var self = this;
    var search_callback = function(response) {
        var res = "";
        response.on("data", function(chunk) {
            res += chunk;
        });
        response.on("end", function() {
            var r = JSON.parse(res);
            //console.log(r);
            r.results.forEach(function(item, index, array) {
                self.render_result(item, "nearby");
            });
        });
    };

    // TODO: get coordinates from the GPS of the device
    var lat = 0;
    var lon = 0;
    var radius = scopes.self.settings["nearbyRadius"].get_double();

    var query_filter = "{!geofilt sfield=geotag pt=" + lat + "," + lon + " d=" + radius + "}";
    if (self.active_department !== "") {
        query_filter += " tag:" + self.active_department;
    };
    var request_url = build_url({
        query_string: canned_query.query_string(),
        page_size: self.page_size,
        filter: query_filter,
    });
    console.log("retrieve_nearby_sounds generated URL: " + request_url);
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
            //console.log(r);
            r.results.forEach(function(item, index, array){
                self.render_result(item, "most_downloaded");
            });
        });
    };

    var query_filter = "";
    if (self.active_department !== "") {
        query_filter += " tag:" + self.active_department;
    };
    var request_url = build_url({
        query_string: canned_query.query_string(),
        page_size: self.page_size,
        sort: "downloads_desc",
        filter: query_filter,
    });
    console.log("retrieve_most_downloaded_sounds generated URL: " + request_url);
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
    console.log("*****")
    console.log("query to send:")
    for (var item in query) {
        console.log(item +": " + query[item])
    };
    console.log("*****")
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
            var root_department = new scopes.lib.Department("", canned_query,
                                                            "All samples");
            TAGS.forEach(function(item, index, array) {
                var sub_department = new scopes.lib.Department(item, canned_query, item);
                root_department.add_subdepartment(sub_department);
            });
            search_reply.register_departments(root_department);
            console.log("metadata:");
            for (var item in metadata) {
                console.log(item + ": " + metadata[item])
            }
            console.log("canned_query:");
            for (var item in canned_query) {
                console.log(item + ": " + canned_query[item])
            }
            console.log("metadata.has_location: " + metadata.has_location());
            console.log("canned_query.department_id: " + canned_query.department_id());
            console.log("canned_query.department_id == '' " + canned_query.department_id() == '');

            var page_size_setting = scopes.self.settings["resultsPerCategory"].get_int();
            var page_size = AVAILABLE_PAGE_SIZES[page_size_setting];

            var freesound_searcher = new CategoryRenderer(search_reply,
                                                          page_size,
                                                          canned_query.department_id());

            var active_department = canned_query.department_id();

            freesound_searcher.retrieve_newest_sounds(canned_query, metadata);
            freesound_searcher.retrieve_most_downloaded_sounds(canned_query, metadata);
            freesound_searcher.retrieve_nearby_sounds(canned_query, metadata);
            //search_reply.finished();
        };

        var cancel_search_cb = function() {};

        return new scopes.lib.SearchQuery(canned_query, metadata,
                                          run_search_cb, cancel_search_cb);
    },

    preview: function(result, action_metadata) {
        var run_preview_cb = function(preview_reply) {
            // layout definition for a screen with only one column
            var layout1col = new scopes.lib.ColumnLayout(1);
            layout1col.add_column(["image", "header", "description", "details", "audio"]);

            // layout definition for a screen with two columns
            var layout2col = new scopes.lib.ColumnLayout(2);
            layout2col.add_column(["image"]);
            layout2col.add_column(["header", "description", "audio"]);

            preview_reply.register_layout([layout1col, layout2col]);

            var image = new scopes.lib.PreviewWidget("image", "image");
            image.add_attribute_mapping("source", "art");

            var header = new scopes.lib.PreviewWidget("header", "header");
            header.add_attribute_mapping("title", "title")
            header.add_attribute_mapping("subtitle", "license")

            //var scope_dir = scopes.self.scope_directory;
            //var cc_image_path = scope_dir + "/by.large.png";
            //header.add_attribute_value("mascot", "file:///" + cc_image_path);

            console.log("scope_directory: " + scopes.self.scope_directory);

            var description = new scopes.lib.PreviewWidget("description",
                                                           "text");
            description.add_attribute_mapping("text", "description");

            var details = new scopes.lib.PreviewWidget("details", "table");
            details.add_attribute_value("title", "Details");
            details.add_attribute_value(
                "values",
                [
                    ["type", result.get("type")],
                    ["channels", result.get("channels")],
                    ["filesize", result.get("filesize")],
                ]
            );
            var audio = new scopes.lib.PreviewWidget("audio", "audio");
            audio.add_attribute_value(
                "tracks",
                {
                     "title": result.get("title"),
                     "source": result.get("audio_preview"),
                }
            );

            preview_reply.push([image, header, description, details, audio]);
            preview_reply.finished();
        };
        var cancel_preview_cb = function() {};
        return new scopes.lib.PreviewQuery(result, action_metadata,
                                           run_preview_cb,
                                           cancel_preview_cb);

    },

    stop: function() {
        console.log('Stopping...')
    }

});
