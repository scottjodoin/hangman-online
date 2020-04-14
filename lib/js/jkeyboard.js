
// the semi-colon before function invocation is a safety net against concatenated
// scripts and/or other plugins which may not be closed properly.
; (function ($, window, document, undefined) {

    // undefined is used here as the undefined global variable in ECMAScript 3 is
    // mutable (ie. it can be changed by someone else). undefined isn't really being
    // passed in so we can ensure the value of it is truly undefined. In ES5, undefined
    // can no longer be modified.

    // window and document are passed through as local variable rather than global
    // as this (slightly) quickens the resolution process and can be more efficiently
    // minified (especially when both are regularly referenced in your plugin).

    // Create the defaults once
    var pluginName = "jkeyboard",
        defaults = {
            layout: "english",
            callBack: window.alert,
            selectable: ['english'],
            input: $('#input'),
            customLayouts: {
                selectable: []
            },
        };
    var callBack = window.alert;
    var layouts = {
        english: [
          ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P',],
          ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L',],
          ['Z', 'X', 'C', 'V', 'B', 'N', 'M']
        ]
    }

    layout = 'english', layout_id = 0;

    // The actual plugin constructor
    function Plugin(element, options) {
        this.element = element;
        // jQuery has an extend method which merges the contents of two or
        // more objects, storing the result in the first object. The first object
        // is generally empty as we don't want to alter the default options for
        // future instances of the plugin
        this.settings = $.extend({}, defaults, options);
        this._defaults = defaults;
        this._name = pluginName;
        this.init();
    }

    Plugin.prototype = {
        init: function () {
            layout = this.settings.layout;
            callBack = this.settings.callBack;
            this.createKeyboard(layout);
            this.events(callBack);
        },

        createKeyboard: function (layout) {
            var keyboard_container = $('<ul/>').addClass('jkeyboard'),
                me = this;

            layouts[layout].forEach(function (line, index) {
                var line_container = $('<li/>').addClass('jline');
                line_container.append(me.createLine(line));
                keyboard_container.append(line_container);
            });

            $(this.element).html('').append(keyboard_container);
        },

        createLine: function (line) {
            var line_container = $('<ul/>');

            line.forEach(function (key, index) {
                var key_container = $('<li/>').addClass('jkey').data('command', key);
                key_container.addClass('letter').html(key);
                line_container.append(key_container);
            })

            return line_container;
        },

        events: function (callBack) {
            var letters = $(this.element).find('.letter')

            me = this;

            letters.on('click', function () {
              //THIS IS THE CLICK FUNCTION
              callBack($(this).text());
            });
        },

        type: function (key) {
            var input = this.settings.input,
                val = input.val(),
                input_node = input.get(0),
                start = input_node.selectionStart,
                end = input_node.selectionEnd;

            var max_length = $(input).attr("maxlength");
            if (start == end && end == val.length) {
                if (!max_length || val.length < max_length) {
                    input.val(val + key);
                }
            } else {
                var new_string = this.insertToString(start, end, val, key);
                input.val(new_string);
                start++;
                end = start;
                input_node.setSelectionRange(start, end);
            }

            input.trigger('focus');

            if (shift && !capslock) {
                this.toggleShiftOff();
            }
        },

        toggleLayout: function () {
            layout_id = layout_id || 0;
            var plain_layouts = this.settings.selectable;
            layout_id++;

            var current_id = layout_id % plain_layouts.length;
            return plain_layouts[current_id];
        },

        insertToString: function (start, end, string, insert_string) {
            return string.substring(0, start) + insert_string + string.substring(end, string.length);
        }
    };


    var methods = {
        init: function(options) {
            if (!this.data("plugin_" + pluginName)) {
                this.data("plugin_" + pluginName, new Plugin(this, options));
            }
        },
        setInput: function(content) {
            this.data("plugin_" + pluginName).setInput($(content));
        },
        setLayout: function(layoutname) {
            // change layout if it is not match current
            object = this.data("plugin_" + pluginName);
            if (typeof(layouts[layoutname]) !== 'undefined' && object.settings.layout != layoutname) {
                object.settings.layout = layoutname;
                object.createKeyboard(layoutname);
                object.events();
            };
        },
    };

    $.fn.jkeyboard = function (methodOrOptions) {
        if (methods[methodOrOptions]) {
            return methods[methodOrOptions].apply(this.first(), Array.prototype.slice.call( arguments, 1));
        } else if (typeof methodOrOptions === 'object' || ! methodOrOptions) {
            // Default to "init"
            return methods.init.apply(this.first(), arguments);
        } else {
            $.error('Method ' +  methodOrOptions + ' does not exist on jQuery.jkeyboard');
        }
    };

})(jQuery, window, document);
