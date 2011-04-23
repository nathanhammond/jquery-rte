(function($) {
	var RTE  = {
		_create: function() {},
		
		// Let's get started.
		_init: function() {
			// Always.
			var plugin = this;

			// Set a state flag.
			plugin.rtemode = false;

			// Make sure we've always got the right elements in any closure.
			var textarea = plugin.element;
			var options = plugin.options;

			// Build the iframe the old-fashioned way to make it work.
			var iframe = document.createElement("iframe");
				iframe.frameBorder = options.iframe.border;
				iframe.frameMargin = options.iframe.margin;
				iframe.framePadding = options.iframe.padding;
				iframe.className = options.iframe.classname;
				iframe.id = options.iframe.idprefix + '-' + textarea.attr('id');
				iframe.src='javascript:';

			// Save ourselves a reference.
			plugin.iframe = iframe;

			// Set the height equal to the replaced element.
			$(iframe).css({ 'width': textarea.width(), 'height': textarea.height() });

			// Add the iframe into the document.
			textarea.after(iframe);
			$(iframe).after('<br style="clear: left;" />')

			// Build content for the iframe.
			var textareacontent = textarea.val();
			if ($.trim(textareacontent) == '') { textareacontent = '<br />'; } // Mozilla needs this to display caret
			var iframecontent = '<html><head><link type="text/css" rel="stylesheet" href="' + options.css + '" /></head><body>' + textareacontent + '</body></html>';

			// Set up the iframe for rich text editing.
			try {
				iframe.contentWindow.document.open();
				iframe.contentWindow.document.write(iframecontent);
				iframe.contentWindow.document.close();
				iframe.contentWindow.document.designMode = "On";
			} catch (e) {
				plugin.destroy();
				return;
			}

			// Congratulations! We're ready for interaction with the iframe.
			textarea.addClass('rte-textarea');

			// Build the toolbar.
			// TODO: allow this to be user-specified.
			plugin._loadtoolbar();
			plugin._buildoverlay();
			plugin._buildmessageblock();

			// Propagate events on the iframe to the textarea.
			var propagate = function (e) { textarea.trigger(e); }

			// Prevent navigation from keypresses.
			if ($.browser.mozilla) {
				$(iframe.contentDocument).bind('keydown', 'meta+left meta+right', function(e) { return false; });				
			}

			$(iframe.contentWindow).bind('scroll focus blur', propagate);
			$(iframe.contentWindow.document).bind('click dblclick keydown keypress keyup copy paste input mousedown mousemove mouseup mouseover mouseout mouseenter mouseleave', propagate);

			// And we're done, turn on rtemode.
			plugin.toggle();
		},

		/* Layout of the RTE itself. */

		// This builds the toolbar, adds its events, and inserts it into the page.
		_loadtoolbar: function() {
			// Make sure we've always got the right elements in any closure.
			var plugin = this;
			var textarea = this.element;
			var iframe = this.iframe;
			plugin.commands = [];

			var formatblock = {
				element: $('<select class="rte-formatblock"></select>'),
				values: [
					{ value: '', text: 'Normal Text' },
					{ value: 'h1', text: 'Header 1' },
					{ value: 'p', text: 'Paragraph' }
				],
				execute: function(value) {
					if (!value) return;
					
					value = '<' + value + '>';
					return iframe.contentWindow.document.execCommand('formatblock', false, value);
				},
				state: function() {
					var value = iframe.contentWindow.document.queryCommandValue('formatblock');
					return (typeof value == "string" ? value.replace(/[<>]*/g,'') : '');
				},
				ui: function() {
					var value = this.state();
					this.element.val(value);
				},
				setup: function() {
					var self = this;
					
					var options = '';
					for (var i = 0; i < this.values.length; i++) {
						options += '<option value="'+this.values[i].value+'">'+this.values[i].text+'</option>';
						if (this.values[i].keyboard) {
							textarea.bind('keydown', this.values[i].keyboard, (function(e) { var which = i; return function() { self.element.val(self.values[which].value); self.element.trigger('change'); e.preventDefault(); } })());
							textarea.bind('keypress', this.values[i].keyboard, false);
						}
					}
					this.element.append(options)

					this.element.get(0).unselectable = "on"; // IE, prevent focus		
					this.element.bind('change', function(e) {
						iframe.contentWindow.focus();
						self.execute($(this).val());
						plugin._updateToolbar();
					});
										
					return this.element;
				}
			};

			var bold = {
				element: $('<a class="rte-bold" href="#">Bold</a>'),
				keyboard: 'meta+b ctrl+b',
				execute: function() {
					return iframe.contentWindow.document.execCommand('Bold', false, null);
				},
				state: function() {
					return iframe.contentWindow.document.queryCommandState('Bold');
				},
				ui: function() {
					if (this.state()) {
						this.element.addClass('active');
					} else {
						this.element.removeClass('active');			
					}
				},
				setup: function() {
					var self = this;

					this.element.get(0).unselectable = "on";
					this.element.bind('mousedown', function(e) {
						e.preventDefault();
					});
					this.element.bind('click', function(e) {
						e.preventDefault();
						self.execute();
						plugin._updateToolbar();
					});

					textarea.bind('keydown', this.keyboard, function(e){ e.preventDefault(); self.execute(); });
					textarea.bind('keypress', this.keyboard, false);
					return this.element;
				}
			};

			var italic = {
				element: $('<a class="rte-italic" href="#">Italic</a>'),
				keyboard: 'meta+i ctrl+i',
				execute: function() {
					return iframe.contentWindow.document.execCommand('Italic', false, null);
				},
				state: function() {
					return iframe.contentWindow.document.queryCommandState('Italic');
				},
				ui: function() {
					if (this.state()) {
						this.element.addClass('active');
					} else {
						this.element.removeClass('active');			
					}
				},
				setup: function() {
					var self = this;

					this.element.get(0).unselectable = "on";
					this.element.bind('mousedown', function(e) {
						e.preventDefault();
					});
					this.element.bind('click', function(e) {
						e.preventDefault();
						self.execute();
						plugin._updateToolbar();
					});

					textarea.bind('keydown', this.keyboard, function(e){ e.preventDefault(); self.execute(); });
					textarea.bind('keypress', this.keyboard, false);
					return this.element;
				}
			};

			var link = {
				element: $('<a class="rte-link" href="#">Link</a>'),
				execute: function() {
					var linktext = plugin._getRange();
					if (!linktext) {
						plugin._buildmessage('Select text first!');
						return false;
					} else {
						plugin._showoverlay(plugin._buildlink(linktext));
					}
				},
				state: function() {},
				ui: function() {},
				setup: function() {
					var self = this;
					this.element.bind('click', function(e) {
						e.preventDefault();
						self.execute();
					});

					return this.element;
				}
			};

			var image = {
				element: $('<a class="rte-image" href="#">Image</a>'),
				execute: function() {
					var linktext = plugin._getRange();
					if (linktext) {
						plugin._buildmessage('Text would be deleted. Select insertion point.');
						return false;
					} else {
						plugin._showoverlay(plugin._buildimage());						
					}
				},
				state: function() {},
				ui: function() {},
				setup: function() {
					var self = this;
					this.element.bind('click', function(e) {
						e.preventDefault();
						self.execute();
					});

					return this.element;
				}
			};

			var toggle = {
				element: $('<a class="rte-toggle" href="#">Toggle</a>'),
				execute: function() { plugin.toggle(); },
				state: function() { return plugin.rtemode; },
				ui: function() {},
				setup: function() {
					var self = this;

					this.element.get(0).unselectable = "on";
					this.element.bind('mousedown', function(e) {
						e.preventDefault();
					});
					this.element.bind('click', function(e) {
						e.preventDefault();
						self.execute();
					});
					
					return this.element;
				}
			};

			plugin.commands.push(formatblock);
			plugin.commands.push(bold);
			plugin.commands.push(italic);
			plugin.commands.push(link);
			plugin.commands.push(image);
			plugin.commands.push(toggle);
			
			var toolbar = $('<ul class="rte-toolbar"></ul>');
			for (var i = 0; i < plugin.commands.length; i++) {
				toolbar.append(plugin.commands[i].setup().wrap('<li></li>'));
			}			

			textarea.bind('click keyup', function() {
				plugin._updateToolbar();
			});

			// .NET compatability
			if(this.options.dot_net_button_class) {
				var dot_net_button = $(iframe).parents('form').find(this.options.dot_net_button_class);
				dot_net_button.click(function() {
					textarea.val(plugin.content());
				});
			// Regular forms
			} else {
				$(iframe).parents('form').submit(function(){
					textarea.val(plugin.content());
				});
			}

			plugin.toolbar = toolbar;
			textarea.before(toolbar);
		},

		_updateToolbar: function() {
			var plugin = this;
			var commands = plugin.commands;

			for (var i = 0; i < commands.length; i++) {
				commands[i].ui();
			}
		},

		// Build the message block. Non-modal information only.
		_buildmessageblock: function() {
			var plugin = this;
			var textarea = plugin.element;

			var messageblock = $('<div class="rte-messageblock"></div>');
			
			textarea.before(messageblock);

			plugin.messageblock = messageblock;
		},
		
		// Helper function to build the message area.
		_buildmessage: function(body) {
			var plugin = this;

			var content = $('<p>' + body + ' <a class="rte-cancel" href="#">Close</a></p>')
			content.find('.rte-cancel').bind('click', function(e) {
				e.preventDefault();
				content.remove();
			});

			// Add the P to the message block target.
			plugin.messageblock.append(content);

			setTimeout(function() {
				content.remove();
			},10000);
		},

		// Build the overlay. Modal, need to act here before doing other things.
		_buildoverlay: function() {
			var plugin = this;
			var overlay = $('<div class="rte-overlay"></div>');
			overlay.hide();
			$('body').append(overlay);

			$(window).bind('resize', function() {
				plugin._positionoverlay();
			});
			plugin.overlay = overlay;
			
			// FIXME: Actually prevent interaction with the rest of the RTE instead of just covering it.
		},

		// For positioning the overlay
		_positionoverlay: function() {
			var plugin = this;
			var toolbar = plugin.toolbar;
			var iframe = plugin.iframe;
			var overlay = plugin.overlay;

			var toolbarposition = toolbar.position();
			var toolbarwidth = toolbar.outerWidth();
			var iframeposition = $(iframe).position();
			var iframewidth = $(iframe).outerWidth();
			var iframeheight = $(iframe).outerHeight();

			var css = {};
			css.top = toolbarposition.top;
			css.left = toolbarposition.left;
			css.width = Math.max(iframewidth, toolbarwidth);
			css.height = - toolbarposition.top + iframeposition.top + iframeheight;

			overlay.css(css);
		},

		// Show the overlay.
		_showoverlay: function(content) {
			var plugin = this;
			var overlay = plugin.overlay;
			plugin._positionoverlay();
			plugin._overlaycontent(content)
			overlay.show();			
		},

		// Hide the overlay.
		_hideoverlay: function() {
			var plugin = this;
			var overlay = plugin.overlay;
			overlay.hide();
			overlay.empty();
		},

		// Set the content of the overlay.
		_overlaycontent: function(content) {
			var plugin = this;
			var overlay = plugin.overlay;
			overlay.append(content);
		},

		// Helper function to build the link url overlay.
		_buildlink: function(linktext) {
			var plugin = this;
			var content = $('<div class="rte-overlay-content">'+ linktext +'URL: <input class="rte-url" type="text" /><input class="rte-cancel" type="button" value="Close" /><input class="rte-submit" type="button" value="Submit" /></div>')
			var $url = content.find('input.rte-url');
			content.find('input.rte-submit').click(function() {
				plugin._execCommand('CreateLink', $url.val());
				plugin._hideoverlay();
			});
			content.find('input.rte-cancel').click(function() {
				plugin._hideoverlay();
			});

			return content;
		},

		// Helper function to build the link url overlay.
		_buildimage: function(linktext) {
			var plugin = this;
			var content = $('<div class="rte-overlay-content">URL: <input class="rte-url" type="text" /><input class="rte-cancel" type="button" value="Close" /><input class="rte-submit" type="button" value="Submit" /></div>')
			var $url = content.find('input.rte-url');
			content.find('input.rte-submit').click(function() {
				plugin._execCommand('InsertImage', $url.val());
				plugin._hideoverlay();
			});
			content.find('input.rte-cancel').click(function() {
				plugin._hideoverlay();
			});

			return content;
		},

		/* Command handling. */

		// Helper function to ensure the commands are correctly passed to the iframe.
		_execCommand: function(command, value) {
			var plugin = this;
			var iframe = plugin.iframe;

			console.log('iframe.contentWindow.document.execCommand('+command+', false, '+value+')');
			console.log(iframe.contentWindow.document.designMode);

			iframe.contentWindow.focus()
			iframe.contentWindow.document.execCommand(command, false, value);
		},
		
		_queryCommand: function(command) {
			var plugin = this;
			var iframe = plugin.iframe;

			iframe.contentWindow.document.queryCommandState(command);
		},

		// Helper function to grab the text value of the range.
		_getRange: function() {
			var iframe = this.iframe;

			var selection;
			var range;
			var value = false;

			if (iframe.contentWindow.document.selection) {
				// IE selections
				selection = iframe.contentWindow.document.selection;
				range = selection.createRange();
				value = range.text;
			} else {
				// Mozilla selections
				try {
					selection = iframe.contentWindow.getSelection();
					range = selection.getRangeAt(0);
					value = range.toString();
				}
				catch(e){
					return false;
				}
			}
			
			return value;
		},

		// Helper function to get the text node the current range is in.
		_getSelectionElement: function() {
			var iframe = this.iframe;

			var selection;
			var range;
			var node;

			if (iframe.contentWindow.document.selection) {
				// IE selections
				selection = iframe.contentWindow.document.selection;
				range = selection.createRange();
				try {
					node = range.parentElement();
				}
				catch (e) {
					return false;
				}
			} else {
				// Mozilla selections
				try {
					selection = iframe.contentWindow.getSelection();
					range = selection.getRangeAt(0);
				}
				catch(e){
					return false;
				}
				node = range.commonAncestorContainer;
			}
			return node;
		},

		// Helper function to do block-level styling.
		_setSelectedType: function(node, select) {
			while(node.parentNode) {
				var nName = node.nodeName.toLowerCase();
				for(var i=0;i<select.options.length;i++) {
					if(nName==select.options[i].value){
						select.selectedIndex=i;
						return true;
					}
				}
				node = node.parentNode;
			}
			select.selectedIndex=0;
			return true;
		},

		// Get textarea; Set textarea.
		_textareacontent: function() {
			var textarea = this.element;
			var content = textarea.val();

			return content;			
		},
		_updatetextarea: function(content) {
			var textarea = this.element;

			content = content != undefined ? content : this._iframecontent();
			
			textarea.val(content);
		},

		// Get iframe; Set iframe.
		_iframecontent: function() {
			var iframe = this.iframe;
			var content = $(iframe.contentWindow.document.body).html();

			return content;
		},
		_updateiframe: function(content) {
			var iframe = this.iframe;

			content = content != undefined ? content : this._textareacontent();

			$(iframe.contentWindow.document.body).html(content);
		},

		/* Public methods. */

		// Set the focus.
		focus: function() {
			var plugin = this;
			var textarea = plugin.element;
			var iframe = plugin.iframe;

			if (plugin.rtemode) {
				iframe.contentWindow.focus();
			} else {
				textarea.focus();
			}
		},

		// Switch from plain-text to HTML and back.
		toggle: function() {
			var plugin = this;
			var textarea = plugin.element;
			var iframe = plugin.iframe;
			var toolbar = plugin.toolbar;

			if (plugin.rtemode) {
				// Switch to HTML view.
				toolbar.find('li').hide().end().find('.rte-toggle').html('RTE').parent().show();
				plugin._updatetextarea();
				$(iframe).hide();
				textarea.show();
			} else {
				// Switch to design view.
				toolbar.find('li').show().end().find('.rte-toggle').html("<img src='"+this.options.media_url+"close.gif' alt='close rte' />");
				plugin._updateiframe();
				$(iframe).show();
				textarea.hide();
			}
			plugin.rtemode = !plugin.rtemode;
			plugin.focus();
		},
		
		// Get the RTE's content. Has to be aware of what state it is in since we don't keep them in sync.
		content: function(content) {
			if (content != undefined) {
				this._updatetextarea(content);
				this._updateiframe();
			} else {
				return this.rtemode ? this._iframecontent() : this._textareacontent();
			}
		},
		
		// Get rid of the plugin.
		destroy: function() {
			var textarea = this.element;
			var iframe = this.iframe;
			var toolbar = this.toolbar;

			if (this.rtemode) {
				this._updatetextarea();
			}
			toolbar.remove();
			$(iframe).remove();
			overlay.remove();
			textarea.removeClass('rte-textarea');
			textarea.show();
		},

		options: {
			media_url: "_img/",
			css: "_css/jquery.rte.css",
			dot_net_button_class: null,
			iframe: { classname: 'rte-iframe', idprefix: 'rte', margin: 0, border: 0, padding: 0 }
		}
	};

	$.widget("ui.rte", RTE);
})(jQuery);
