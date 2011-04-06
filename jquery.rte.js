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
				iframe.className = this.options.iframe.class;
				iframe.id = this.element.attr('id') + '_' + this.options.iframe.idsuffix;
			this.iframe = iframe;

			// Add the iframe into the document.
			textarea.after(iframe);

			// Add content to the iframe.
			var iframecontent = '<html><head><link type="text/css" rel="stylesheet" href="' + this.options.css + '" /></head><body>' + content + '</body></html>';
			this._designmode(iframecontent);		
		},
		_designmode: function(iframecontent) {
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

			// Try again in case the iframe is taking its own sweet time.
			setTimeout(function() { plugin._designmode(iframecontent); }, 500);
		},
		_iframeready: function() {
			this.loaded = true;
			this.design = true;

			var textarea = this.element;
			var iframe = this.iframe;

			// Great, we're set.
			this._loadtoolbar();
			textarea.hide();
		},
		_loadtoolbar: function() {
			var plugin = this;
			var textarea = this.element;
			var iframe = this.iframe;

			var tb = $("<div class='rte-toolbar'><div>\
				<p>\
					<select>\
						<option value=''>Block style</option>\
						<option value='p'>Paragraph</option>\
						<option value='h3'>Title</option>\
						<option value='address'>Address</option>\
					</select>\
				</p>\
				<p>\
					<a href='#' class='bold'><img src='"+this.options.media_url+"bold.gif' alt='bold' /></a>\
					<a href='#' class='italic'><img src='"+this.options.media_url+"italic.gif' alt='italic' /></a>\
				</p>\
				<p>\
					<a href='#' class='unorderedlist'><img src='"+this.options.media_url+"unordered.gif' alt='unordered list' /></a>\
					<a href='#' class='link'><img src='"+this.options.media_url+"link.png' alt='link' /></a>\
					<a href='#' class='image'><img src='"+this.options.media_url+"image.png' alt='image' /></a>\
					<a href='#' class='disable'><img src='"+this.options.media_url+"close.gif' alt='close rte' /></a>\
				</p></div></div>");

			$('select', tb).change(function(){
				var index = this.selectedIndex;
				if( index!=0 ) {
					var selected = this.options[index].value;
					plugin._formatText("formatblock", '<'+selected+'>');
				}
			});
			$('.bold', tb).click(function(){ plugin._formatText('bold');return false; });
			$('.italic', tb).click(function(){ plugin._formatText('italic');return false; });
			$('.unorderedlist', tb).click(function(){ plugin._formatText('insertunorderedlist');return false; });
			$('.link', tb).click(function(){
				var p=prompt("URL:");
				if(p)
					plugin._formatText('CreateLink', p);
				return false; });

			$('.image', tb).click(function(){
				var p=prompt("image URL:");
				if(p)
					plugin._formatText('InsertImage', p);
				return false; });

			$('.disable', tb).click(function() {
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

			var select = $('select', tb)[0];
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
					var h = Math.min(this.options.max_height, iframe_height+body.scrollTop()) + 'px';
					iframe.style['height'] = h;
				}
				return true;
			});

			this.toolbar = tb;
			textarea.before(tb);
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
		_getSelectionElement: function() {
			var iframe = this.iframe;

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
		_updatetextarea: function() {
			
		},
		toggle: function() {
			var plugin = this;
			var textarea = this.element;
			var iframe = this.iframe;
			var toolbar = this.toolbar;

			if (this.design) {
				// Switch to HTML view.
				toolbar.children().hide();
				var edm = $('<a class="rte-edm" href="#">Enable design mode</a>');
				toolbar.append(edm);
				$(iframe).hide();
				textarea.show();
				edm.click(function(e){
					e.preventDefault();
					plugin.toggle();
					// remove, for good measure
					$(this).remove();
				});
			} else {
				toolbar.children().show();
				$(iframe).show();
				textarea.hide();
				// Switch to design view.
			}
			this.design = !this.design;
		},
		content: function() {
			var iframe = this.iframe;
			var content;
		
			// Which one?
			content = iframe.contentWindow.document.getElementsByTagName("body")[0].innerHTML;
			content = $(iframe).contents().find("body").html();

			return content;
		},
		destroy: function() {
			
		},
		options: {
			media_url: "_img/",
			css: "_css/rte.css",
			dot_net_button_class: null,
			max_height: 350,
			iframe: { class: 'rte', idsuffix: 'iframe', margin: 0, border: 0, padding: 0 }
		}
	};
	$.widget("ui.rte", RTE);
})(jQuery);
