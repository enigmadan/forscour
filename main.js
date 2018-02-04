var fs = require('fs');
const electron = require('electron');
var screenElectron = electron.screen;




// If absolute URL from the remote server is provided, configure the CORS
// header on that server.
// var url = '//cdn.mozilla.net/pdfjs/tracemonkey.pdf';
var data = new Uint8Array(fs.readFileSync('files/litweb.pdf'));


// The workerSrc property shall be specified.
PDFJS.workerSrc = 'pdfjs/pdf.worker.min.js';

var pdfDoc = null,
	layout = 2, //1 or 2 page viewing
	pageNum = 1,
	pageRendering = false,
	pageNumPending = null,
	scale = 5,
	canvases = 10,
	canvasArr = [],
	context = [],
	ms = screenElectron.getPrimaryDisplay().bounds;

document.getElementById('canvases').style.height = ms.height + 'px';
log(ms);
for (var i = 0; i < canvases; i++) {
	log(i);
	canvasArr[i] = document.createElement('canvas');
	canvasArr[i].id = 'c'+i;
	document.getElementById('canvas-wrap-1').appendChild(canvasArr[i]);
	context[i] = canvasArr[i].getContext('2d');
	i++;
	log(i);
	canvasArr[i] = document.createElement('canvas');
	canvasArr[i].id = 'c'+i;
	document.getElementById('canvas-wrap-2').appendChild(canvasArr[i]);
	context[i] = canvasArr[i].getContext('2d');
}

/**
 * Get page info from document, resize canvas accordingly, and render page.
 * @param num Page number.
 */
function renderPage(num) {
	var index = (num - 1) % canvases;
	var canvas = canvasArr[index];
	var ctx = context[index];
	if (num <= pdfDoc.numPages) {
		pageRendering = true;
		// Using promise to fetch the page

		pdfDoc.getPage(num).then(function(page) {
			var viewport = page.getViewport(scale);
			log(viewport);
			canvas.height = viewport.height;
			canvas.width = viewport.width;
			if(canvas.height/(1.0*canvas.width)>=ms.height/(1.0*ms.width/2.0)) {
				//constrain by height
				canvas.style.height = ms.height + 'px';
			}else{
				canvas.style.width = ms.width/2 + 'px';
			}

			// Render PDF page into canvas context
			var renderContext = {
				canvasContext: ctx,
				viewport: viewport
			};
			var renderTask = page.render(renderContext);

			// Wait for rendering to finish
			renderTask.promise.then(function() {
				pageRendering = false;
				if (pageNumPending !== null) {
					// New page rendering is pending
					renderPage(pageNumPending);
					pageNumPending = null;
				}
			});
		});
	} else {
		ctx.clearRect(0, 0, canvasArr[index-1].width, canvasArr[index-1].height);
	}
	// Update page counters
}

/**
 * If another page rendering in progress, waits until the rendering is
 * finised. Otherwise, executes rendering immediately.
 */
function queueRenderPage(num) {
  if (pageRendering) {
    pageNumPending = num;
  } else {
    for (var i = 0; i < canvases; i++)
      renderPage(num + i);
  }
}

/**
 * renders previous pages.
 */
function renderPrev(num) {
  if (pageNum <= 1) {
	return;
  }
  pageNum -= num;
  queueRenderPage(pageNum);
}
/**
 * renders next pages.
 */
function renderNext(num) {
  if (pageNum + num >= pdfDoc.numPages) {
	return;
  }
  pageNum +=num;
  queueRenderPage(pageNum);
}

var page = 0;
function hideShowPages(){
	log(page);
	for (var i = 0; i < canvasArr.length; i++) {
		if(i >= page && i <= page+layout-1){
			canvasArr[i].hidden = false;
		}else{
			canvasArr[i].hidden = true;
		}
	}
	document.getElementById('page_num').textContent = (page+1) + (layout>1 && page+layout<=pdfDoc.numPages?'-' + (page+layout):'');
}
function prevPage(){
	if(page>0){
		page-=layout;
		hideShowPages();
	}else{
		log("nope");
	}
}
function nextPage(){
	if(page+layout<pdfDoc.numPages){
		page+=layout;
		hideShowPages();
	}else{
		log("nope");
	}
}
document.getElementById('prev').addEventListener('pointerdown', prevPage);
document.getElementById('next').addEventListener('pointerdown', nextPage);

/**
 * Asynchronously downloads PDF.
 */
PDFJS.getDocument(data).then(function(pdfDoc_) {
  pdfDoc = pdfDoc_;
  hideShowPages();
  document.getElementById('page_count').textContent = pdfDoc.numPages;

  // Initial/first page rendering
  for (var i = 0; i < 10; i++) {
    renderPage(1 + i);
  }
});


/******************************************
HELPERS
******************************************/
function log(object){
  console.log(object);
}