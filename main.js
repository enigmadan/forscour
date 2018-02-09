const fs = require('fs');
const path = require('path');
const electron = require('electron');
var screenElectron = electron.screen;


// The workerSrc property shall be specified.
PDFJS.workerSrc = 'pdfjs/pdf.worker.min.js';

var pdfDoc = null,
	layout = 2, //1 or 2 page viewing
	canvases = 30,
	canvasArr = [],
	context = [],
	renderedMin = 0,
	renderedMax = renderedMin+canvases-1,
	pageRendering = false,
	pageNumPending = null,
	scale = 5,
	ms = screenElectron.getPrimaryDisplay().bounds;

document.getElementById('canvases').style.height = ms.height + 'px';
for (var i = 0; i < canvases; i++) {
	canvasArr[i] = document.createElement('canvas');
	canvasArr[i].id = 'c'+i;
	document.getElementById('canvas-wrap-1').appendChild(canvasArr[i]);
	context[i] = canvasArr[i].getContext('2d');
	i++;
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
	canvas.title = '' + num;
	var ctx = context[index];
	if (num <= pdfDoc.numPages) {
		pageRendering = true;
		// Using promise to fetch the page

		pdfDoc.getPage(num).then(function(page) {
			var viewport = page.getViewport(scale);
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
					renderPage(pageNumPending[0],pageNumPending[1]);
					pageNumPending = null;
				}
			});
		});
	} else {
		ctx.clearRect(0, 0, ms.width/2, ms.height);
	}
	// Update page counters
}

/**
 * If another page rendering in progress, waits until the rendering is
 * finised. Otherwise, executes rendering immediately.
 */
function queueRenderPage(newN, oldN) {
	if (pageRendering) {
		log((newN-oldN) + ' pending');
		pageNumPending = (newN,oldN);
	} else {
		var temp = newN-oldN; //-if min; +if max
		log(temp);
		for (var i = (temp<0?temp:0); i < (temp<0?0:temp); i++) { //if temp is negative, i will be negative. if positive, positive.
			log(oldN + i + ' rendering');
			renderPage(oldN + i);
		}
	}
}

/**
 * renders previous pages.
 */
function renderPrev(num) {
	if (renderedMin < 1) {
		return;
	}
	var prevMin = renderedMin;
	var temp = renderedMin - num < 0 ? renderedMin : num;
	renderedMin -= temp;
	renderedMax -= temp;
	log(renderedMin + '-' + renderedMax + ' rendered');
	queueRenderPage(renderedMin,prevMin);
}
/**
 * renders next pages.
 */
function renderNext(num) {
	if (renderedMax >= pdfDoc.numPages) {
		return;
	}
	var prevMax = renderedMax;
	var temp = renderedMax + num > pdfDoc.numPages ? pdfDoc.numPages + 1 - renderedMax : num;
	renderedMax += temp;
	renderedMin += temp;
	log(renderedMin + '-' + renderedMax + ' rendered');
	queueRenderPage(renderedMax, prevMax);
}

var page = 0;
function hideShowPages(){
	log(page);
	for (var i = 0; i < canvasArr.length; i++) {
		if(i >= page%canvases && i <= (page%canvases)+layout-1 && page < pdfDoc.numPages){
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
		log(page+'-'+renderedMin+'='+(page-renderedMin)+'<='+(canvases/3));
		if(page-renderedMin<=canvases/3){
			renderPrev(canvases/3);
		}
	}else{
		log("nope");
	}
}
function nextPage(){
	if(page+layout<pdfDoc.numPages){
		page+=layout;
		hideShowPages();
		log(renderedMax+'-'+page+'='+(renderedMax-page)+'<='+(canvases/3));
		if(renderedMax-page<=canvases/3){
			log("This happened.");
			renderNext(canvases/3);
		}
	}else{
		log("nope");
	}
}
document.getElementById('prev').addEventListener('pointerdown', prevPage);
document.getElementById('next').addEventListener('pointerdown', nextPage);

/**
 * Creates directory listing given directory
 */
const walkSync = (d) => fs.statSync(d).isDirectory() ? fs.readdirSync(d).map(f => walkSync(path.join(d, f))) : d;
var files = walkSync('files/');
var fileEx = document.getElementById('explorer');
fileEx.innerHTML = "";
for (var i = 0; i < files.length; i++) {
	log(files[i]);
	var file = files[i].split('\\')[1];
	var a = document.createElement('a');
	var linkText = document.createTextNode(file);
	a.appendChild(linkText);
	a.title = file;
	a.href = 'javascript:loadPdf("'+file+'")';
	fileEx.appendChild(a);
}
// loadPdf('36q.pdf');

/**
 * Asynchronously downloads PDF.
 */
function loadPdf(pdf){
	log('Loading '+ pdf);
	// If absolute URL from the remote server is provided, configure the CORS
	// header on that server.
	// var url = '//cdn.mozilla.net/pdfjs/tracemonkey.pdf';
	var data = new Uint8Array(fs.readFileSync('files/'+pdf));

	PDFJS.getDocument(data).then(function(pdfDoc_) {
		pdfDoc = pdfDoc_;
		page = 0;
		renderedMin = 0;
		renderedMax = renderedMin+canvases-1;

		hideShowPages();
		document.getElementById('page_count').textContent = pdfDoc.numPages;

		// Initial/first page rendering
		for (var i = 0; i < canvases; i++) {
			renderPage(1 + i);
		}
	});
}

/******************************************
HELPERS
******************************************/
function log(object){
  console.log(object);
}