(function($) {
	var RTE  = {
		_create: function() {},
		_init: function() {
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

			// Add the iframe into the document.
			textarea.after(iframe);
			$(iframe).after('<br / style="clear: left;">')

			// Add content to the iframe.
			var iframecontent = '<html><head><link type="text/css" rel="stylesheet" href="' + this.options.css + '" /></head><body>' + content + '</body></html>';
			this._designmode(iframecontent, this.options.attempts);		
		},
		_designmode: function(iframecontent, remaining) {
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
			}
		},
		_iframeready: function() {
			this.loaded = true;
			this.design = true;

			var textarea = this.element;
			var iframe = this.iframe;

			// Great, we're set.
			this._loadtoolbar();
			textarea.addClass('rte-textarea');
			textarea.hide();
		},
		_loadtoolbar: function() {
			var plugin = this;
			var textarea = this.element;
			var iframe = this.iframe;
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
					plugin._formatText("formatoolbarlock", '<'+selected+'>');
				}
			});
			$('.rte-bold', toolbar).click(function(){ plugin._formatText('bold');return false; });
			$('.rte-italic', toolbar).click(function(){ plugin._formatText('italic');return false; });
			$('.rte-unorderedlist', toolbar).click(function(){ plugin._formatText('insertunorderedlist');return false; });
			$('.rte-link', toolbar).click(function(){
				if (!plugin._getRange()) { alert('Select text first!'); return false; }
				var p=prompt("URL:");
				if(p)
					plugin._formatText('CreateLink', p);
				return false; });

			$('.rte-image', toolbar).click(function(){
				var p=prompt("image URL:");
				if(p)
					plugin._formatText('InsertImage', p);
				return false; });

			$('.rte-toggle', toolbar).click(function() {
				plugin.toggle();
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

			var iframeDoc = $(iframe.contentWindow.document);

			var select = $('select', toolbar)[0];
			iframeDoc.mouseup(function(){
				plugin._setSelectedType(plugin._getSelectionElement(), select);
				return true;
			});

			iframeDoc.keyup(function() {
				plugin._setSelectedType(plugin._getSelectionElement(), select);
				var body = $('body', iframeDoc);
				if(body.scrollTop() > 0) {
					var iframe_height = parseInt(iframe.style['height'])
					if(isNaN(iframe_height))
						iframe_height = 0;
					var h = Math.min(plugin.options.max_height, iframe_height+body.scrollTop()) + 'px';
					iframe.style['height'] = h;
				}
				return true;
			});

			this.toolbar = toolbar;
			textarea.before(toolbar);
		},
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

		/* Get textarea; Set textarea. */
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

		/* Get iframe; Set iframe. */
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
		content: function() {
			if (this.design) {
				return this._iframecontent();
			} else {
				return this._textareacontent();
			}
		},
		destroy: function() {
			var textarea = this.element;
			var iframe = this.iframe;
			var toolbar = this.toolbar;

			if (this.design) {
				this._updatetextarea();
			}
			toolbar.remove();
			$(iframe).remove();
			textarea.show();
		},
		options: {
			media_url: "_img/",
			css: "_css/jquery.rte.css",
			dot_net_button_class: null,
			max_height: 350,
			iframe: { classname: 'rte-iframe', idprefix: 'rte', margin: 0, border: 0, padding: 0 },
			attempts: 3
		}
	};
	$.widget("ui.rte", RTE);
})(jQuery);
