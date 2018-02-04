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
	pageNum = 1,
	pageRendering = false,
	pageNumPending = null,
	scale = 5,
	canvas1 = document.getElementById('canvas-1'),
	canvas2 = document.getElementById('canvas-2'),
	ctx1 = canvas1.getContext('2d');
	ctx2 = canvas2.getContext('2d');

	var mainScreen = screenElectron.getPrimaryDisplay();
	log(mainScreen.workAreaSize.width+ 'x' +mainScreen.workAreaSize.height); //1620x1080

	//canvas.width<=810
	//canvas.height<=1080

/**
 * Get page info from document, resize canvas accordingly, and render page.
 * @param num Page number.
 */
function renderPage(num) {
	pageRendering = true;
	// Using promise to fetch the page
	pdfDoc.getPage(num).then(function(page) {
		var viewport = page.getViewport(scale);
		log(viewport);
		canvas1.height = viewport.height;
		canvas1.width = viewport.width;
		if(canvas1.height/(1.0*canvas1.width)>=1.333){
			//constrain by height
			canvas1.style.height = 1080 + 'px';
		}else{
			canvas1.style.width = 810 + 'px';
		}


		// Render PDF page into canvas context
		var renderContext = {
			canvasContext: ctx1,
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
	if(num < pdfDoc.numPages){
		pdfDoc.getPage(num+1).then(function(page) {
			var viewport = page.getViewport(scale);
			log(viewport);
			canvas2.height = viewport.height;
			canvas2.width = viewport.width;
			if(canvas2.height/(1.0*canvas2.width)>=1.333){
				//constrain by height
				canvas2.style.height = 1080 + 'px';
			}else{
				canvas2.style.width = 810 + 'px';
			}


			// Render PDF page into canvas context
			var renderContext = {
				canvasContext: ctx2,
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
		document.getElementById('page_num').textContent = num + '-' + (num+1);
	}else{
		ctx2.clearRect(0, 0, canvas2.width, canvas2.height);
		document.getElementById('page_num').textContent = num;
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
	renderPage(num);
  }
}

/**
 * Displays previous page.
 */
function onPrevPage() {
  if (pageNum <= 1) {
	return;
  }
  pageNum -= 2;
  queueRenderPage(pageNum);
}
document.getElementById('prev').addEventListener('pointerdown', onPrevPage);

/**
 * Displays next page.
 */
function onNextPage() {
  if (pageNum >= pdfDoc.numPages) {
	return;
  }
  pageNum +=2;
  queueRenderPage(pageNum);
}
document.getElementById('next').addEventListener('pointerdown', onNextPage);

/**
 * Asynchronously downloads PDF.
 */
PDFJS.getDocument(data).then(function(pdfDoc_) {
  pdfDoc = pdfDoc_;
  document.getElementById('page_count').textContent = pdfDoc.numPages;

  // Initial/first page rendering
  renderPage(pageNum);
});


/******************************************
HELPERS
******************************************/
function log(object){
  console.log(object);
}