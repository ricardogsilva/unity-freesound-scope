var scopes = require('unity-js-scopes')
var http = require('http');
var url = require('url');

var freesound_host = "www.freesound.org";
var freesound_api_key = "insert_your_API_key_here";
var freesound_page_size = 2;
var text_search_path = '/apiv2/search/text/';

var LATEST_SOUNDS_CATEGORY_DEFINITION = {
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
            current_text_search_cb = function(response) {
                var res = "";
                response.on("data", function(chunk) {
                    res += chunk;
                });
                response.on("end", function() {
                    var r = JSON.parse(res);
                    console.log(r);
                    var category_renderer = new scopes.lib.CategoryRenderer(
                        JSON.stringify(LATEST_SOUNDS_CATEGORY_DEFINITION));
                    var category = search_reply.register_category(
                        'latest', 'latest sounds',
                        '', category_renderer
                    );
                    for (var i=0; i < r.results.length; i++) {
                        var item = r.results[i]
                        var sound_instance_url = url.format({
                            protocol: 'http',
                            hostname: freesound_host,
                            pathname: 'apiv2/sounds/' + item.id + '/',
                            query: {
                                token: freesound_api_key,
                                page_size: freesound_page_size,
                            }
                        });
                        console.log('sound_instance_url: ' + sound_instance_url);
                        http.request(sound_instance_url, function(response) {
                            var res = '';
                            response.on("data", function(chunk) {
                                res += chunk;
                            });
                            response.on("end", function() {
                                var sound_item = JSON.parse(res);
                                var categorised_result = new scopes.lib.CategorisedResult(category);
                                console.log('response: ' + JSON.stringify(sound_item));
                                categorised_result.set_uri(sound_item.id.toString());
                                categorised_result.set_title(sound_item.name);
                                categorised_result.set('license', sound_item.license);
                                categorised_result.set('description', sound_item.description);
                                categorised_result.set('tags', sound_item.tags);
                                categorised_result.set('art', sound_item.images.waveform_l);
                                categorised_result.set('audio_preview', sound_item.previews["preview-lq-mp3"]);
                                categorised_result.set('all', sound_item);
                                search_reply.push(categorised_result);
                            });
                        }).end();
                    }
                    //search_reply.finished();
                });
            }
            var request_url = url.format({
                protocol: 'http',
                hostname: freesound_host,
                pathname: text_search_path,
                query: {
                    token: freesound_api_key,
                    page_size:freesound_page_size,
                    query: canned_query.query_string()
                },
            });
            http.request(request_url, current_text_search_cb).end();
        };

        var cancel_search_cb = function() {};

        return new scopes.lib.SearchQuery(canned_query, metadata,
                                          run_search_cb, cancel_search_cb);
    },

    preview: function(result, action_metadata) {
        var run_preview_cb = function(preview_reply) {
            // layout definition for a screen with only one column
            var layout1col = new scopes.lib.ColumnLayout(1);
            layout1col.add_column(["image", "header", "description", "audio"]);

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

            var description = new scopes.lib.PreviewWidget("description",
                                                           "text");
            description.add_attribute_mapping("text", "description");

            var audio = new scopes.lib.PreviewWidget("audio", "audio");
            audio.add_attribute_value(
                "tracks",
                {
                     "title": result.get("title"),
                     "source": result.get("audio_preview"),
                }
            );

            preview_reply.push([image, header, description, audio]);
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
