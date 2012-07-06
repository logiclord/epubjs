var page_stack = new Array();
var oebps_dir = '';
var opf_file = '';
var ncx_file = '';
var abs_container_bottom = null;
var epub_version = 2;
var current_chapter = {};
var current_selection_height = 600;
var current_selection = {from : 0, to : current_selection_height};

function process_content() {
	$('#content').show();
	selectionReset();
	createSelection($('#content'),current_selection.from,current_selection.to);
}
function createSelection(node,from,to) {
	if(!node) {
		return null; 
	}
	var top = node.offset().top;
	var bottom = top + node.height();

	console.log(node);
	console.log(top + " " + bottom);
	console.log(from + " " + to);
	
	if (to <= top || from >= bottom) {
		return false;
	} else if (from <= top && to >= bottom) {
		return true;
	} else {
		var ret = false;
		node.children().each(function() {
			var temp = createSelection($(this), from, to);
			if (temp === false) {
				$(this).hide();
			} else {
				ret = true;
			}
		});
		return ret;
	}
}

function selectionReset() {
	current_selection.from = $('#content').offset().top;
	current_selection.to = current_selection.from  + current_selection_height;
}

function load_content() {
	page = $(this).attr('href');
	
	// Unselect other sections
	$('.selected').attr('class', 'unselected');
	$(this).attr('class', 'selected');
	
	// $('#content').load(page, null, process_content);
	current_chapter = imageToDataURI(getDataFromEpub(page), getFolder(page));
	$('#content').html(current_chapter.content);
	$('#chapter_style').html(current_chapter.styles);
	
	selectionReset();
	process_content();
	
	return false;
}

function next() {
	var top = page_stack[page_stack.length - 1].bottom;
	if (top) {
		top.prevAll('p').hide();
		top.hide();
		if (top.nextAll('p').length == 0) {
			return next_chapter();
		}
		top.nextAll('p').show();
	} else {
		next_chapter();
		selectionReset();
		process_content();
	}

}
function previous() {
	/*
	 * If we have no pages to go back to, call the previous chapter function
	 * instead. This isn't really what the reader probably means -- they want to
	 * turn back to the previous _page_ before the beginning of that chapter,
	 * but we could only potentially do that if we had visited the page already
	 * and had it in the stack.
	 */
	var status = page_stack.pop();
	if (status == null) {
		return process_content();
	}
	if (status.top.prev('p').length == 0) {
		return previous_chapter();
	}
	status.top.hide();
	status = page_stack.pop();
	status.bottom.hide();
	status.top.show();
	status.top.nextAll('p:hidden').show();
	process_content();
}

function next_chapter() {
	// Simulate a click event on the next chapter after the selected one
	$('a.selected').parent().next('li').find('a').click();

	// How far is the selected chapter now from the bottom border?
	var selected_position = $('a.selected').position().top;
	var height_of_toc = $('a.selected').height();

	if (selected_position - (height_of_toc * 2) > abs_container_bottom / 2) {
		// Hide the first visible chapter item
		$('#toc a:visible:eq(0)').hide();
	}
	$('#remaining').css('width', '0px');
}

function previous_chapter() {
	// Simulate a click event on the next chapter after the selected one
	$('a.selected').parent().prev('li').find('a').click();

	// Have we hidden any chapters that we now want to show?
	$('#toc a:visible:eq(0)').parent().prev('li').find('a').show();

	$('#remaining').css('width', '0px');
}

/* Open the container file to find the resources */
function container(f) {

	opf_file = $(f).find('rootfile').attr('full-path');
	// Get the OEPBS dir, if there is one
	if (opf_file.indexOf('/') != -1) {
		oebps_dir = opf_file.substr(0, opf_file.lastIndexOf('/'));
	}

	// opf_file = epub_dir + '/' + opf_file;
	// jQuery.get(opf_file, {}, opf);
	getDataFromEpub(opf_file, function(response) {
		opf(response);
	});
}

/* Open the TOC, get the first item and open it */
function toc(f) {

	// ePub 2 compatibility to parse toc.ncx file
	if (epub_version === 2) {
		
		// Some ebooks use navPoint while others use ns:navPoint tags
		var nav_tag = 'ns\\:navPoint';
		var content_tag = 'ns\\:content';
		var text_tag = 'ns\\:text';
		
		if ($(f).find('ns\\:navPoint').length == 0) {
			nav_tag = 'navPoint';
			content_tag = 'content';
			text_tag = 'text';
		}
		
		$(f).find(nav_tag).each(
				function() {
				
					var s = $('<span/>').text(
							$(this).find(text_tag+':first').text());
					var a = $('<a/>').attr(
							'href',
							oebps_dir
							+ '/'
							+ $(this).find(content_tag).attr(
							'src'));
					// If 's' has a parent navPoint, indent it
					if ($(this).parent()[0].tagName.toLowerCase() == nav_tag ) {
						s.addClass('indent');
					}
					s.appendTo(a);
					a.appendTo($('<li/>').appendTo('#toc'));
				});
	}

	// ePub 3 compatibility to parse toc.xhtml file
	if (epub_version === 3) {
		$(f).filter('nav[epub:type="toc"]').find('li').each(
				function() {
					var s = $('<span/>').text($(this).find('a:first').text());
					var a = $('<a/>').attr('href', oebps_dir + '/' + $(this).find('a:first').attr('href'));
					
					// If 's' has a parent navPoint, indent it
					if ($(this).parent().parent()[0].tagName.toLowerCase() === 'li') {
						s.addClass('indent');
					}
					s.appendTo(a);
					a.appendTo($('<li/>').appendTo('#toc'));
				});
	}

	// Click on the desired first item link
	$('#toc a:eq(0)').click();

}
/* Open the OPF file and read some useful metadata from it */
function opf(f) {

	// Get the document title
	// Depending on the browser, namespaces may or may not be handled here
	var title = $(f).find('title').text(); // Safari
	var author = $(f).find('creator').text();
	
	$('#content-title').html(title + ' by ' + author);
	// Firefox
	if (title == null || title == '') {
		$('#content-title').html(
				$(f).find('dc\\:title').text() + ' by '
						+ $(f).find('dc\\:creator').text());
	}
	// Get the NCX
	var opf_item_tag = 'opf\\:item';
	var epub_version_tag = 'opf\\:package';
	
	if ($(f).find('opf\\:item').length == 0) {
		opf_item_tag = 'item';
		epub_version_tag = 'package';
	}

	epub_version = parseInt($('<div/>').append($(f)).find(epub_version_tag).attr('version'), 10);
	
	$(f).find(opf_item_tag).each(
			function() {
				// Cheat and find the first file ending in NCX
				// modified to include ePub 3 support
				if ($(this).attr('href').indexOf('.ncx') != -1
						|| $(this).attr('id').toLowerCase() === 'toc') {
					ncx_file = oebps_dir + '/' + $(this).attr('href');
					// jQuery.get(ncx_file, {}, toc);
					// console.log(ncx_file);
					getDataFromEpub(ncx_file, function(response) {
						toc(response);
					});
				}
			});

}
jQuery(document).ready(function() {

	runTest();

	// jQuery.get(epub_dir + '/META-INF/container.xml', {}, container);
	$('#toc a').live('click', load_content);
	/*
	$('#book').resizable({
		alsoResize : '#content',
		stop : function() {
			$('#content p').show();
			process_content();
		}
	});


	$('html').mousewheel(function(event, delta) {
		if (delta > 0) // up
			previous();
		else if (delta < 0) // down
			next();
		return false; // prevent default
	});
*/
	$(document).bind('keydown', function(e) {
		var code = (e.keyCode ? e.keyCode : e.which);
		if (code == 78) { // 'n'
			next();
		}
		if (code == 80) { // 'p'
			previous();
		}
		if (code == 74) { // 'j'
			next_chapter();
		}
		if (code == 75) { // 'k'
			previous_chapter();
		}
	});
});
