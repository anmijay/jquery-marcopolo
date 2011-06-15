/**
 * Marco Polo v1.1.4
 *
 * A modern jQuery plugin for autocomplete functionality on a text input.
 *
 * https://github.com/jstayton/jquery-marcopolo
 *
 * Copyright 2011 by Justin Stayton
 * Released under the MIT License
 * http://en.wikipedia.org/wiki/MIT_License
 */
(function($) {
  // The cache spans all instances and is indexed by URL. This allows different
  // instances to pull the same cached results if their URLs match.
  var cache = {};

  // Default settings.
  var defaults = {
    // Whether to cache query results.
    cache: true,
    // Whether to compare the selected item against items displayed in the
    // results list. The selected item is highlighted if a match is found,
    // instead of the first item in the list (by default). Set this option to
    // 'true' if the data is a string; otherwise, specify the data object
    // attribute name to compare on.
    compare: false,
    // Additional data to be sent in the request query string.
    data: {},
    // The number of milliseconds to delay before firing a request after a
    // change is made to the input value.
    delay: 250,
    // Format the raw data that's returned from the ajax request. Useful for
    // further filtering the data or returning the array of results that's
    // embedded deeper in the object.
    formatData: null,
    // Format the text that's displayed when the ajax request fails. Setting
    // this option to 'null' or returning 'false' suppresses the message from
    // being displayed.
    formatError: function($item, $input, $list, jqXHR, textStatus, errorThrown) {
      return '<em>Your search could not be completed at this time.</em>';
    },
    // Format the display of each item in the results list.
    formatItem: function(data, $item, $input, $list) {
      return data.title || data.name;
    },
    // Format the text that's displayed when the minimum number of characters
    // (specified with the 'minChars' option) hasn't been reached. Setting this
    // option to 'null' or returning 'false' suppresses the message from being
    // displayed.
    formatMinChars: function(minChars, $item, $input, $list) {
      return '<em>Your search must be at least <strong>' + minChars + '</strong> characters.</em>';
    },
    // Format the text that's displayed when there are no results returned for
    // the requested input value. Setting this option to 'null' or returning
    // 'false' suppresses the message from being displayed.
    formatNoResults: function(q, $item, $input, $list) {
      return '<em>No results for <strong>' + q + '</strong>.</em>';
    },
    // Whether to hide the results list when an item is selected. The results
    // list is still hidden when the input is blurred for any other reason.
    hideOnSelect: true,
    // The minimum number of characters required before a request is fired.
    minChars: 1,
    // Called when the input value changes.
    onChange: null,
    // Called when the ajax request fails.
    onError: null,
    // Called when the input field receives focus.
    onFocus: null,
    // Called when the minimum number of characters (specified with the
    // 'minChars' option) hasn't been reached by the end of the 'delay'.
    onMinChars: null,
    // Called when there are no results returned for the request.
    onNoResults: null,
    // Called before the ajax request is made.
    onRequestBefore: null,
    // Called after the ajax request completes (success or error).
    onRequestAfter: null,
    // Called when there are results to be displayed.
    onResults: null,
    // Called when an item is selected from the results list or passed in
    // through the 'selected' option.
    onSelect: function(data, $item, $input, $list) {
      $input.val(data.title || data.name);
    },
    // The name of the query string parameter that is set with the input value.
    param: 'q',
    // Whether to clear the input value when no selection is made from the
    // results list.
    required: false,
    // The list items to make selectable.
    selectable: '*',
    // Prime the input with a selected item.
    selected: null,
    // The URL to GET request for the results.
    url: null
  };

  // Key code to key name mapping for easy reference.
  var keys = {
    DOWN: 40,
    ENTER: 13,
    ESC: 27,
    UP: 38
  };

  // Get the first selectable item in the results list.
  var firstSelectableItem = function($list) {
    return $list.children('li.mp_selectable:first');
  };

  // Get the last selectable item in the results list.
  var lastSelectableItem = function($list) {
    return $list.children('li.mp_selectable:last');
  };

  // Get the currently highlighted item in the results list.
  var highlighted = function($list) {
    return $list.children('li.mp_highlighted');
  };

  // Remove the highlight class from the specified item.
  var removeHighlight = function($item) {
    return $item.removeClass('mp_highlighted');
  };

  // Add the highlight class to the specified item.
  var addHighlight = function($item, $list) {
    // The current highlight is removed to ensure that only one item is
    // highlighted at a time.
    removeHighlight(highlighted($list));

    return $item.addClass('mp_highlighted');
  };

  // Highlight the first selectable item in the results list.
  var highlightFirst = function($list) {
    return addHighlight(firstSelectableItem($list), $list);
  };

  // Highlight the item before the currently highlighted item.
  var highlightPrev = function($list) {
    var $highlighted = highlighted($list);
    var $prev = $highlighted.prevAll('li.mp_selectable:first');

    // If there is no "previous" selectable item, continue at the list's end.
    if (!$prev.length) {
      $prev = lastSelectableItem($list);
    }

    return addHighlight($prev, $list);
  };

  // Highlight the item after the currently highlighted item.
  var highlightNext = function($list) {
    var $highlighted = highlighted($list);
    var $next = $highlighted.nextAll('li.mp_selectable:first');

    // If there is no "next" selectable item, continue at the list's beginning.
    if (!$next.length) {
      $next = firstSelectableItem($list);
    }

    return addHighlight($next, $list);
  };

  // Show the results list.
  var showList = function($list) {
    return $list.show();
  };

  // Hide the results list.
  var hideList = function($list) {
    return $list.hide();
  };

  // Build the results list from a successful request.
  var buildSuccessList = function($input, $list, settings, q, data) {
    // Empty the list of its previous results.
    $list.empty();

    // Fire 'formatData' callback.
    if (settings.formatData) {
      data = settings.formatData.call($input, data, $input, $list);
    }

    // If there are no results...
    if ($.isEmptyObject(data)) {
      var $item = $('<li class="mp_no_results" />');

      // Fire 'formatNoResults' callback.
      var formatNoResults = settings.formatNoResults && settings.formatNoResults.call($input, q, $item, $input, $list);

      formatNoResults && $item.html(formatNoResults);

      // Fire 'onNoResults' callback.
      settings.onNoResults && settings.onNoResults.call($input, q, $item, $input, $list);
      $input.trigger('marcopolonoresults', [q, $item, $input, $list]);

      // Displaying a "no results" message is optional. It isn't displayed if
      // the 'formatNoResults' callback returns a false value.
      if (formatNoResults) {
        $item.appendTo($list);

        showList($list);
      }
      else {
        hideList($list);
      }
    }
    else {
      // The currently selected item data for use in comparison.
      var selected = $input.data('marcoPolo').selected;

      // Whether to compare the currently selected item with the results. A
      // 'compare' setting key has to be specified, and there must be a
      // currently selected item.
      var compare = settings.compare && selected;
      var compareCurrent;
      var compareSelected;
      var compareMatch = false;

      // Loop through each result and add it to the list.
      for (var i = 0, datum; datum = data[i]; i++) {
        var $item = $('<li class="mp_item" />');
        var formatItem = settings.formatItem.call($input, datum, $item, $input, $list);

        // Store the original data for easy access later.
        $item.data('marcoPolo', datum);

        $item
          .html(formatItem)
          .appendTo($list);

        if (compare) {
          // If the 'compare' setting is set to boolean 'true', assume the data
          // is a string and compare directly.
          if (settings.compare === true) {
            compareCurrent = datum;
            compareSelected = selected;
          }
          // Otherwise, assume the data is an object and the 'compare' setting
          // is the attribute name to compare on.
          else {
            compareCurrent = datum[settings.compare];
            compareSelected = selected[settings.compare];
          }

          // Highlight this item if it matches the selected item.
          if (compareCurrent === compareSelected) {
            addHighlight($item, $list);

            // Stop comparing the remaining results, as a match has been made.
            compare = false;
            compareMatch = true;
          }
        }
      }

      // Mark all selectable items, based on the 'selectable' selector setting.
      $list
        .children(settings.selectable)
        .addClass('mp_selectable');

      // Highlight the first item in the results list if the currently selected
      // item was not found and already highlighted.
      if (!compareMatch) {
        highlightFirst($list);
      }

      // Fire 'onResults' callback.
      settings.onResults && settings.onResults.call($input, data, $input, $list);
      $input.trigger('marcopoloresults', [data, $input, $list]);

      showList($list);
    }
  };

  // Build the results list with an error message.
  var buildErrorList = function($input, $list, settings, jqXHR, textStatus, errorThrown) {
    $list.empty();

    var $item = $('<li class="mp_error" />');

    // Fire 'formatError' callback.
    var formatError = settings.formatError &&
                      settings.formatError.call($input, $item, $input, $list, jqXHR, textStatus, errorThrown);

    formatError && $item.html(formatError);

    // Fire 'onError' callback.
    settings.onError && settings.onError.call($input, $item, $input, $list, jqXHR, textStatus, errorThrown);
    $input.trigger('marcopoloerror', [$item, $input, $list, jqXHR, textStatus, errorThrown]);

    // Displaying an error message is optional. It isn't displayed if the
    // 'formatError' callback returns a false value.
    if (formatError) {
      $item.appendTo($list);

      showList($list);
    }
    else {
      hideList($list);
    }
  };

  // Build the results list with a message when the minimum number of
  // characters hasn't been entered.
  var buildMinCharsList = function($input, $list, settings, q) {
    // Don't display the minimum characters list when there are no characters.
    if (!q.length) {
      hideList($list).empty();

      return;
    }

    $list.empty();

    var $item = $('<li class="mp_min_chars" />');

    // Fire 'formatMinChars' callback.
    var formatMinChars = settings.formatMinChars &&
                         settings.formatMinChars.call($input, settings.minChars, $item, $input, $list);

    formatMinChars && $item.html(formatMinChars);

    // Fire 'onMinChars' callback.
    settings.onMinChars && settings.onMinChars.call($input, settings.minChars, $item, $input, $list);
    $input.trigger('marcopolominchars', [settings.minChars, $item, $input, $list]);

    // Displaying a minimum characters message is optional. It isn't displayed
    // if the 'formatMinChars' callback returns a false value.
    if (formatMinChars) {
      $item.appendTo($list);

      showList($list);
    }
    else {
      hideList($list);
    }
  };

  // Cancel any pending ajax request and input key buffer.
  var cancelPendingRequest = function($input) {
    // Abort the ajax request if still in progress.
    if ($input.data('marcoPolo').ajax) {
      $input.data('marcoPolo').ajaxAborted = true;
      $input.data('marcoPolo').ajax.abort();
    }
    else {
      $input.data('marcoPolo').ajaxAborted = false;
    }

    // Clear the request buffer.
    clearTimeout($input.data('marcoPolo').timer);

    return $input.data('marcoPolo').ajaxAborted;
  };

  // Mark the input as changed due to a different value.
  var change = function(q, $input, $list, settings) {
    // Reset the currently selected item.
    $input.data('marcoPolo').selected = null;

    // Keep track of the new input value for later comparison.
    $input.data('marcoPolo').value = q;

    // Fire 'onChange' callback.
    settings.onChange && settings.onChange.call($input, q, $input, $list);
    $input.trigger('marcopolochange', [q, $input, $list]);
  };

  // Make a request for the specified query and build the results list.
  var request = function(q, $input, $list, settings) {
    cancelPendingRequest($input);

    // Check if the input value has changed.
    if (q !== $input.data('marcoPolo').value) {
      change(q, $input, $list, settings);
    }

    // Requests are buffered the number of ms specified by the 'delay' setting.
    // This helps prevent an ajax request for every keystroke.
    $input.data('marcoPolo').timer = setTimeout(function() {
      // Display the minimum characters message if not reached.
      if (q.length < settings.minChars) {
        buildMinCharsList($input, $list, settings, q);

        return;
      }

      // Add the query to the additional data to be sent with the request.
      var param = {};
      param[settings.param] = q;

      var params = $.extend({}, settings.data, param);

      // Build the request URL with query string data to use as the cache key.
      var cacheKey = settings.url + (settings.url.indexOf('?') === -1 ? '?' : '&') + $.param(params);

      // Check for and use cached results if enabled.
      if (settings.cache && cache[cacheKey]) {
        buildSuccessList($input, $list, settings, q, cache[cacheKey]);
      }
      // Otherwise, make an ajax request for the data.
      else {
        // Fire 'onRequestBefore' callback.
        settings.onRequestBefore && settings.onRequestBefore.call($input, $input, $list);
        $input.trigger('marcopolorequestbefore', [$input, $list]);

        // Add a class to the input's parent that can be hooked-into by the CSS
        // to show a busy indicator.
        $inputParent = $input.parent().addClass('mp_busy');

        // The ajax request is stored in case it needs to be aborted.
        $input.data('marcoPolo').ajax = $.ajax({
          url: settings.url,
          dataType: 'json',
          data: params,
          success:
            function(data) {
              buildSuccessList($input, $list, settings, q, data);

              // Cache the data.
              cache[cacheKey] = data;
            },
          error:
            function(jqXHR, textStatus, errorThrown) {
              // Show the error message unless the ajax request was aborted by
              // this plugin. 'ajaxAborted' is used because 'errorThrown' does
              // not faithfull return "aborted" as the cause.
              if (!$input.data('marcoPolo').ajaxAborted) {
                buildErrorList($input, $list, settings, jqXHR, textStatus, errorThrown);
              }
            },
          complete:
            function(jqXHR, textStatus) {
              // Reset ajax reference now that it's complete.
              $input.data('marcoPolo').ajax = null;
              $input.data('marcoPolo').ajaxAborted = false;

              // Remove the "busy" indicator class on the input's parent.
              $inputParent.removeClass('mp_busy');

              // Fire 'onRequestAfter' callback.
              settings.onRequestAfter && settings.onRequestAfter.call($input, $input, $list, jqXHR, textStatus);
              $input.trigger('marcopolorequestafter', [$input, $list, jqXHR, textStatus]);
            }
        });
      }
    }, settings.delay);
  };

  // Select an item from the results list.
  var select = function(data, $item, $input, $list, settings) {
    if (settings.hideOnSelect) {
      hideList($list);
    }

    // Save the selection as the currently selected item.
    $input.data('marcoPolo').selected = data;

    // Fire 'onSelect' callback.
    settings.onSelect && settings.onSelect.call($input, data, $item, $input, $list);
    $input.trigger('marcopoloselect', [data, $item, $input, $list]);

    // Store the latest input value for later comparison, as it's common to
    // update the value with the selected item during 'onSelect'.
    $input.data('marcoPolo').value = $input.val();
  };

  // Dismiss the results list and cancel any pending activity.
  var dismiss = function($input, $list, settings) {
    cancelPendingRequest($input);

    // Empty the input value if the 'required' setting is enabled
    // and nothing was selected.
    if (settings.required && !$input.data('marcoPolo').selected) {
      $input.val('');
    }

    hideList($list);
  };

  // "Public" methods that can be called on the plugin.
  var methods = {
    // Initialize the plugin on the selected input fields.
    init:
      function(options) {
        return this.each(function() {
          var $input = $(this);

          // Check if the input has already been initialized.
          if ($input.data('marcoPolo')) {
            return;
          }

          // The current 'autocomplete' value is remembered for when 'destroy'
          // is called and the input is returned to its original state.
          var autocomplete = $input.attr('autocomplete');

          // Disable the browser's autocomplete functionality so that it
          // doesn't interfere with this plugin's results.
          $input.attr('autocomplete', 'off');

          // Create an empty list for displaying future results. Insert it
          // directly after the input element.
          var $list = $('<ol class="mp_list" />')
                        .hide()
                        .insertAfter($input);

          // Combine default and instance settings.
          var settings = $.extend({}, defaults, options);

          // If no 'url' setting is specified, use the parent form's 'action'.
          if (!settings.url) {
            settings.url = $input.closest('form').attr('action');
          }

          // All "instance" variables are saved to the jQuery object for easy
          // access throughout its life.
          $input.data('marcoPolo', {
            ajax: null,
            ajaxAborted: false,
            autocomplete: autocomplete,
            documentMouseup: null,
            focus: false,
            $list: $list,
            mousedown: false,
            selected: null,
            selectedMouseup: false,
            settings: settings,
            timer: null,
            value: $input.val()
          });

          $input
            .bind('focus.marcoPolo', function() {
              // It's overly complicated to check if an input field has focus,
              // so "manually" keep track in the 'focus' and 'blur' events.
              $input.data('marcoPolo').focus = true;

              // If this focus is the result of a mouse selection (which re-
              // focuses on the input), ignore as if a blur never occurred.
              if ($input.data('marcoPolo').selectedMouseup) {
                $input.data('marcoPolo').selectedMouseup = false;
              }
              // For everything else, initiate a request.
              else {
                // Fire 'onFocus' callback.
                settings.onFocus && settings.onFocus.call($input, $input, $list);
                $input.trigger('marcopolofocus', [$input, $list]);

                request($input.val(), $input, $list, settings);
              }
            })
            .bind('keydown.marcoPolo', function(key) {
              switch (key.which) {
                case keys.UP:
                  // The default moves the cursor to the beginning or end of
                  // the input value. Keep it in its current place.
                  key.preventDefault();

                  // Highlight the previous item.
                  highlightPrev($list);

                  // Show the list if it has been hidden by ESC.
                  showList($list);

                  break;

                case keys.DOWN:
                  // The default moves the cursor to the beginning or end of
                  // the input value. Keep it in its current place.
                  key.preventDefault();

                  // Highlight the next item.
                  highlightNext($list);

                  // Show the list if it has been hidden by ESC.
                  showList($list);

                  break;

                case keys.ENTER:
                  // Prevent the form from submitting on enter.
                  key.preventDefault();

                  // Select the currently highlighted item.
                  var $highlighted = highlighted($list);

                  if ($highlighted.length) {
                    select($highlighted.data('marcoPolo'), $highlighted, $input, $list, settings);
                  }

                  break;

                case keys.ESC:
                  dismiss($input, $list, settings);

                  break;
              }
            })
            .bind('keyup.marcoPolo', function(key) {
              // Check if the input value has changed. This prevents keys like
              // CTRL and SHIFT from firing a new request.
              if ($input.val() !== $input.data('marcoPolo').value) {
                request($input.val(), $input, $list, settings);
              }
            })
            .bind('blur.marcoPolo', function() {
              $input.data('marcoPolo').focus = false;

              // When an item in the results list is clicked, the input blur
              // event fires before the click event, causing the results list
              // to become hidden (code below). This 1ms timeout ensures that
              // the click event code fires before that happens.
              setTimeout(function() {
                // If the $list 'mousedown' event has fired without a 'mouseup'
                // event, wait for that before dismissing everything.
                if (!$input.data('marcoPolo').mousedown) {
                  dismiss($input, $list, settings);

                  $list.empty();
                }
              }, 1);
            });

          $list
            .mousedown(function() {
              // Tracked for use in the input 'blur' event.
              $input.data('marcoPolo').mousedown = true;
            })
            .delegate('li.mp_selectable', 'mouseover', function() {
              addHighlight($(this), $list);
            })
            .delegate('li.mp_selectable', 'mouseout', function() {
              removeHighlight($(this));
            })
            .delegate('li.mp_selectable', 'mouseup', function() {
              var $item = $(this);

              select($item.data('marcoPolo'), $item, $input, $list, settings);

              // This event is tracked so that when 'focus' is called on the
              // input (below), a new request isn't fired.
              $input.data('marcoPolo').selectedMouseup = true;

              // Give focus back to the input for easy tabbing on to the next
              // field.
              $input.focus();
            });

          // A reference to this function is maintained for unbinding in the
          // 'destroy' method. This is necessary because the selector is so
          // generic ('document').
          $input.data('marcoPolo').documentMouseup = function() {
            // Tracked for use in the input 'blur' event.
            $input.data('marcoPolo').mousedown = false;

            // Ensure that everything is dismissed if anything other than the
            // input is clicked. (A click on a selectable list item is handled
            // above, before this code fires.)
            if (!$input.data('marcoPolo').focus && $list.is(':visible')) {
              dismiss($input, $list, settings);

              $list.empty();
            }
          };

          // Bind the above function.
          $(document).bind('mouseup.marcoPolo', $input.data('marcoPolo').documentMouseup);

          // Initialize the input with a selected item.
          if (settings.selected) {
            select(settings.selected, null, $input, $list, settings);
          }
        });
      },
    // Programmatically change the input value without triggering a search
    // request (use the 'search' method for that). If the value is different
    // than the current input value, the 'onChange' callback is fired.
    change:
      function(q) {
        return this.each(function() {
          var $input = $(this);
          var data = $input.data('marcoPolo');
          var $list = data.$list;
          var settings = data.settings;

          // Skip if this plugin was never initialized on the input.
          if (!data) {
            return;
          }

          // Change the input value if a new value is specified.
          if (q !== data.value) {
            $input.val(q);

            change(q, $input, $list, settings);

            // Dismiss and empty the existing results to prevent future stale
            // results in case the change is made while the input has focus.
            dismiss($input, $list, settings);

            $list.empty();
          }
        });
      },
    // Remove the autocomplete functionality and return the selected input
    // fields to their original state.
    destroy:
      function() {
        return this.each(function() {
          var $input = $(this);
          var data = $input.data('marcoPolo');

          // Skip if this plugin was never initialized on the input.
          if (!data) {
            return;
          }

          // Remove the results list element.
          data.$list.remove();

          // Re-enable 'autocomplete' on the input if it was enabled initially.
          if (data.autocomplete !== 'off') {
            $input.removeAttr('autocomplete');
          }

          // Remove all events and data specific to this plugin.
          $(document).unbind('mouseup.marcoPolo', $input.data('marcoPolo').documentMouseup);

          $input
            .unbind('.marcoPolo')
            .removeData('marcoPolo');
        });
      },
    // Get or set one or more options.
    option:
      function(nameOrValues, value) {
        // Return all options if no arguments are specified.
        if (typeof nameOrValues === 'undefined') {
          var $input = $(this);
          var data = $input.data('marcoPolo');

          // Skip if this plugin was never initialized on the input.
          if (!data) {
            return;
          }

          return data.settings;
        }
        else if (typeof value === 'undefined') {
          // Set multiple options if an object is passed.
          if ($.isPlainObject(nameOrValues)) {
            return this.each(function() {
              var $input = $(this);
              var data = $input.data('marcoPolo');

              // Skip if this plugin was never initialized on the input.
              if (!data) {
                return;
              }

              data.settings = $.extend(data.settings, nameOrValues);
            });
          }
          // Otherwise, return a specific option value.
          else {
            var $input = $(this);
            var data = $input.data('marcoPolo');

            // Skip if this plugin was never initialized on the input.
            if (!data) {
              return;
            }

            return data.settings[nameOrValues];
          }
        }
        // If both arguments are specified, set a specific option.
        else {
          return this.each(function() {
            var $input = $(this);
            var data = $input.data('marcoPolo');

            // Skip if this plugin was never initialized on the input.
            if (!data) {
              return;
            }

            data.settings[nameOrValues] = value;
          });
        }
      },
    // Programmatically trigger a search request using the existing input value
    // or a new one.
    search:
      function(q) {
        return this.each(function() {
          var $input = $(this);
          var data = $input.data('marcoPolo');

          // Skip if this plugin was never initialized on the input.
          if (!data) {
            return;
          }

          // Change the input value if a new value is specified. Otherwise, use
          // the existing input value.
          if (typeof q !== 'undefined') {
            $input.val(q);
          }

          // Focus on the input to start the request and enable keyboard
          // navigation (only available when the input has focus).
          $input.focus();
        });
      }
  };

  // Standard jQuery plugin pattern.
  $.fn.marcoPolo = function(method) {
    if (methods[method]) {
      return methods[method].apply(this, Array.prototype.slice.call(arguments, 1));
    }
    else if (typeof method === 'object' || !method) {
      return methods.init.apply(this, arguments);
    }
    else {
      $.error('Method ' +  method + ' does not exist on jQuery.marcoPolo');
    }
  };
})(jQuery);