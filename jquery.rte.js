(function($) {
	var RTE  = {
		_create: function() {},
		
		// Let's get started.
		_init: function() {
			// Set some state flags.
			this.design = false;
			this.loaded = false;

			// Make sure we've always got the right elements in any closure.
			var textarea = this.element;
			var content = textarea.val();

			// Mozilla needs this to display caret
			if ($.trim(content) == '') {
				content = '<br />';
			}

			// Build the iframe the old-fashioned way to make it work.
			var iframe = document.createElement("iframe");
				iframe.frameBorder = this.options.iframe.border;
				iframe.frameMargin = this.options.iframe.margin;
				iframe.framePadding = this.options.iframe.padding;
				iframe.className = this.options.iframe.classname;
				iframe.id = this.options.iframe.idprefix + '-' + this.element.attr('id');
			this.iframe = iframe;

			// Set the height equal to the replaced element.
			$(iframe).css({ 'width': textarea.width(), 'height': textarea.height() });

			// Add the iframe into the document.
			textarea.after(iframe);
			$(iframe).after('<br style="clear: left;" />')

			// Add content to the iframe.
			var iframecontent = '<html><head><link type="text/css" rel="stylesheet" href="' + this.options.css + '" /></head><body>' + content + '</body></html>';
			this._designmode(iframecontent, this.options.attempts);		
		},
		
		// The iframe has been added to the page, try and set it to design mode.
		_designmode: function(iframecontent, remaining) {
			// Make sure we've always got the right elements in any closure.
			var plugin = this;
			var textarea = this.element;
			var iframe = this.iframe;

			try {
				// Add the content to the iframe
				iframe.contentWindow.document.open();
				iframe.contentWindow.document.write(iframecontent);
				iframe.contentWindow.document.close();
			} catch (error) {
				// No way to recover from unsuccessfully writing the iframe content.
			}

			if (document.contentEditable) {
				iframe.contentWindow.document.designMode = "On";
				this._iframeready()
				return;
			} else if (document.designMode != null) {
				try {
					iframe.contentWindow.document.designMode = "on";
					this._iframeready()
					return;
				} catch (error) {
					// No way to recover from failing to enter design mode.
				}
			}

			if (remaining-- > 0) {
				// Try again in case the iframe is taking its own sweet time.
				setTimeout(function() { plugin._designmode(iframecontent, remaining); }, 500);
			} else {
				this.destroy();
			}
		},

		// The iframe is loaded, we're ready to toggle on design mode.
		_iframeready: function() {
			// Set some state flags.
			this.loaded = true;

			// Capture the textarea.
			var textarea = this.element;

			// Build the toolbar.
			// TODO: allow this to be user-specified.
			this._loadtoolbar();
			this._buildoverlay();
			textarea.addClass('rte-textarea');

			// And we're done.
			this.toggle();
		},

		// This builds the toolbar, adds its events, and inserts it into the page.
		_loadtoolbar: function() {
			// Make sure we've always got the right elements in any closure.
			var plugin = this;
			var textarea = this.element;
			var iframe = this.iframe;

			// Build the toolbar.
			var toolbar = $("<ul class='rte-toolbar'>\
				<li>\
					<select>\
						<option value=''>Block style</option>\
						<option value='p'>Paragraph</option>\
						<option value='h3'>Title</option>\
						<option value='address'>Address</option>\
					</select>\
				</li>\
				<li><a href='#' class='rte-bold'><img src='"+this.options.media_url+"bold.gif' alt='bold' /></a></li>\
				<li><a href='#' class='rte-italic'><img src='"+this.options.media_url+"italic.gif' alt='italic' /></a></li>\
				<li><a href='#' class='rte-unorderedlist'><img src='"+this.options.media_url+"unordered.gif' alt='unordered list' /></a></li>\
				<li><a href='#' class='rte-link'><img src='"+this.options.media_url+"link.png' alt='link' /></a></li>\
				<li><a href='#' class='rte-image'><img src='"+this.options.media_url+"image.png' alt='image' /></a></li>\
				<li><a href='#' class='rte-toggle'><img src='"+this.options.media_url+"close.gif' alt='close rte' /></a></li>\
			</ul>");

			$('select', toolbar).change(function(){
				var index = this.selectedIndex;
				if( index!=0 ) {
					var selected = this.options[index].value;
					plugin._formatText("formatblock", '<'+selected+'>');
				}
			});
			
			toolbar.delegate('a', 'click', function() {
				$this = $(this);
				var action = $this.attr('class').split('-')[1];

				switch (action) {
					case 'link':
						var linktext = plugin._getRange();
						if (!linktext) {
							plugin._showoverlay(plugin._buildmessage('Select text first!'));
							return false;
						}

						plugin._showoverlay(plugin._buildlink(linktext));
						break;
					case 'image':
						var linktext = plugin._getRange();
						if (linktext) {
							plugin._showoverlay(plugin._buildmessage('Text would be deleted. Select insertion point.'));
							return false;
						}

						plugin._showoverlay(plugin._buildimage());
						break;
					case 'toggle':
						plugin.toggle();
						break;
					default:
						// bold, italic, unorderedlist
						plugin._formatText(action);
						break;
				}
				return false;
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

			var $iframeDoc = $(iframe.contentWindow.document);
			var select = $('select', toolbar)[0];
			$iframeDoc.bind('mouseup keyup', function(){
				plugin._setSelectedType(plugin._getSelectionElement(), select);
				return true;
			});

			this.toolbar = toolbar;
			textarea.before(toolbar);
		},

		// Build the overlay.
		_buildoverlay: function() {
			var plugin = this;
			var overlay = $('<div class="rte-overlay"></div>');
			overlay.hide();
			$('body').append(overlay);

			$(window).bind('resize', function() {
				plugin._positionoverlay();
			});
			this.overlay = overlay;
		},

		// For positioning the overlay
		_positionoverlay: function() {
			var toolbar = this.toolbar;
			var iframe = this.iframe;
			var overlay = this.overlay;

			var toolbarposition = toolbar.position();
			var iframeposition = $(iframe).position();
			var toolbarwidth = toolbar.outerWidth();
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
			var overlay = this.overlay;
			this._positionoverlay();
			this._overlaycontent(content)
			overlay.show();			
		},

		// Hide the overlay.
		_hideoverlay: function() {
			var overlay = this.overlay;
			overlay.hide();
			overlay.empty();
		},

		// Set the content of the overlay.
		_overlaycontent: function(content) {
			var overlay = this.overlay;
			overlay.append(content);
		},

		// Helper function to build the message URL overlay.
		_buildmessage: function(message) {
			var plugin = this;
			var content = $('<div class="rte-overlay-content">' + message + '<input class="rte-cancel" type="button" value="Close" /></div>')
			content.find('input.rte-cancel').click(function() {
				plugin._hideoverlay();
			});
			
			return content;
		},

		// Helper function to build the link url overlay.
		_buildlink: function(linktext) {
			var plugin = this;
			var content = $('<div class="rte-overlay-content">'+ linktext +'URL: <input class="rte-url" type="text" /><input class="rte-cancel" type="button" value="Close" /><input class="rte-submit" type="button" value="Submit" /></div>')
			var $url = content.find('input.rte-url');
			content.find('input.rte-submit').click(function() {
				plugin._formatText('CreateLink', $url.val());
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
				plugin._formatText('InsertImage', $url.val());
				plugin._hideoverlay();
			});
			content.find('input.rte-cancel').click(function() {
				plugin._hideoverlay();
			});

			return content;
		},

		// Helper function to ensure the commands are correctly passed to the iframe.
		_formatText: function(command, option) {
			var iframe = this.iframe;

			iframe.contentWindow.focus();
			try{
				iframe.contentWindow.document.execCommand(command, false, option);
			}catch(e){
				//console.log(e)
			}
			iframe.contentWindow.focus();
		},

		// Helper function to grab the text value of the range.
		_getRange: function() {
			var iframe = this.iframe;

			var selection;
			var range;
			
			if (iframe.contentWindow.document.selection) {
				// IE selections
				selection = iframe.contentWindow.document.selection;
				range = selection.createRange();
			} else {
				// Mozilla selections
				try {
					selection = iframe.contentWindow.getSelection();
					range = selection.getRangeAt(0);
				}
				catch(e){
					return false;
				}
			}
			var set = (range && range.toString() != '');
			var value = set ? range.toString() : false;

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
		_updatetextarea: function() {
			var textarea = this.element;
			var iframe = this.iframe;
			
			textarea.val(this._iframecontent());			
		},

		// Get iframe; Set iframe.
		_iframecontent: function() {
			var iframe = this.iframe;
			var content = iframe.contentWindow.document.getElementsByTagName("body")[0].innerHTML;

			return content;
		},
		_updateiframe: function() {
			var textarea = this.element;
			var iframe = this.iframe;

			$(iframe).contents().find("body").html(this._textareacontent());
		},

		/* Public methods. */

		// Switch from plain-text to HTML and back.
		toggle: function() {
			var textarea = this.element;
			var iframe = this.iframe;
			var toolbar = this.toolbar;

			if (this.design) {
				// Switch to HTML view.
				toolbar.find('li').hide().end().find('.rte-toggle').html('RTE').parent().show();
				this._updatetextarea();
				$(iframe).hide();
				textarea.show();
			} else {
				// Switch to design view.
				toolbar.find('li').show().end().find('.rte-toggle').html("<img src='"+this.options.media_url+"close.gif' alt='close rte' />");
				this._updateiframe();
				$(iframe).show();
				textarea.hide();
			}
			this.design = !this.design;
		},
		
		// Get the RTE's content. Has to be aware of what state it is in since we don't keep them in sync.
		content: function() {
			return this.design ? this._iframecontent() : this._iframecontent();
		},
		
		// Get rid of the plugin.
		destroy: function() {
			var textarea = this.element;
			var iframe = this.iframe;
			var toolbar = this.toolbar;

			if (this.design) {
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
			iframe: { classname: 'rte-iframe', idprefix: 'rte', margin: 0, border: 0, padding: 0 },
			attempts: 3
		}
	};
	$.widget("ui.rte", RTE);
})(jQuery);
