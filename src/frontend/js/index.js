const fs = require('fs');
const path = require('path');
const electron = require('electron');
var screenElectron = electron.screen;

/******************************************
HELPERS
******************************************/
var log = console.log.bind(window.console);

/* From Modernizr */
function whichAnimationEvent(){
    var t;
    var el = document.createElement('fakeelement');
    var animations = {
      'animation':'animationend',
    }

    for(t in animations){
        if( el.style[t] !== undefined ){
            return animations[t];
        }
    }
}
/* Listen for a animation! */
var animationEvent = whichAnimationEvent();

function mod(n, m) {
	return ((n % m) + m) % m;
}

/******************************************/


// The workerSrc property shall be specified.
PDFJS.workerSrc = '../pdfjs/pdf.worker.min.js';

var pdfDoc = null,
	layout = 2, //1 or 2 page viewing
	canvases = 30,
	canvasArr = [],
	context = [],
	renderedMin = 0,
	renderedMax = renderedMin+canvases-1,
	pageRendering = false,
	pageNumPending = null,
	scale = 2,
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
	var index = mod(num - 1, canvases);
	log("index");
	log(index,num);
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
					queueRenderPage(pageNumPending[0],pageNumPending[1]);
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
	log('prev');
	if(page>0){
		//p0 current L
		//p1 current R
		//p2 new L
		//p3 new R
		var p0 = canvasArr[page%canvases];
		var p1 = canvasArr[(page+1)%canvases];
		page-=layout;
		var p2 = canvasArr[page%canvases];
		var p3 = canvasArr[(page+1)%canvases];

		p0.style.zIndex = 1;
		p1.style.zIndex = 1;
		p3.style.zIndex = 2;
		p2.style.zIndex = 0;
		p2.hidden = false;

		p0.classList.add("prevEven");
		p0.addEventListener(animationEvent, function() {
			p0.removeEventListener(animationEvent,arguments.callee);
			p0.hidden = true;
			p0.classList.remove("prevEven");
			p3.classList.add("prevOdd");
			p3.hidden = false;
			p3.addEventListener(animationEvent, function() {
				p3.removeEventListener(animationEvent,arguments.callee);
				p1.hidden = true;
				p3.classList.remove("prevOdd");
			});
		});
		if(page-renderedMin<=canvases/3){
			renderPrev(canvases/3);
		}
	}else{
		// log("nope");
	}
}
function nextPage(){
	log('next');
	if(page+layout<pdfDoc.numPages){
		var p0 = canvasArr[page%canvases];
		var p1 = canvasArr[(page+1)%canvases];
		page+=layout;
		var p2 = canvasArr[page%canvases];
		var p3 = canvasArr[(page+1)%canvases];

		p0.style.zIndex = 1;
		p1.style.zIndex = 1;
		p2.style.zIndex = 2;
		p3.style.zIndex = 0;
		p3.hidden = false;

		p1.classList.add("nextOdd");
		p1.addEventListener(animationEvent, function() {
			p1.removeEventListener(animationEvent,arguments.callee);
			p1.hidden = true;
			p1.classList.remove("nextOdd");
			p2.classList.add("nextEven");
			p2.hidden = false;
			p2.addEventListener(animationEvent, function() {
				p2.removeEventListener(animationEvent,arguments.callee);
				p0.hidden = true;
				p2.classList.remove("nextEven");
			});
		});

		if(renderedMax-page<=canvases/3){
			// log("This happened.");
			renderNext(canvases/3);
		}
	}else{
		// log("nope");
	}
}

/**
 * Creates directory listing given directory
 */
function setupMenu(){
	const walkSync = (d) => fs.statSync(d).isDirectory() ? fs.readdirSync(d).map(f => walkSync(path.join(d, f))) : d;
	var files = walkSync('files/');
	fileEx = document.getElementById('explorer');
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
}
// loadPdf('36q.pdf');
setupMenu();
setupNav();

function setupNav(){
	navEnabled = true;
	document.onkeydown = function(e) {
		if(navEnabled){
			e = e || window.event;
			switch(e.key) {
				case 'ArrowLeft':
					prevPage();
				break;
				case 'ArrowRight':
					nextPage();
				break;
				default:
					return;
			}
		}else{
			return;
		}
	}

	var touchMe = document.getElementById('app');
	var imLeft = document.getElementById('prev');
	var imRight = document.getElementById('next');

	touch = new Hammer(touchMe);
	touchL = new Hammer(imLeft);
	touchR = new Hammer(imRight);

	touch.on("swipeleft swiperight tap press", function(ev) {
		if(ev.pointerType=='pen'){
			log('openEditor');
		}else{
			if(ev.type == 'swipeleft'){
				nextPage();
			}else if(ev.type == 'swiperight'){
				prevPage();
			}else if(ev.type == 'press'){
				fileEx.hidden = false;
			}
		}
		// log(ev.target);
	});
	touchL.on("tap", function(ev) {
		if(ev.pointerType=='pen'){
			log('openEditor');
		}else{
			prevPage();
		}
		log(ev.target);
	});
	touchR.on("tap", function(ev) {
		if(ev.pointerType=='pen'){
			log('openEditor');
		}else{
			nextPage();
		}
		// log(ev.target);
	});
	// touch.set({enable: false});
	toggleNav(false);
}

function toggleNav(enabled = !navEnabled){
	touch.set({enable: enabled});
	touchL.set({enable: enabled});
	touchR.set({enable: enabled});
	navEnabled = enabled;
}
/**
 * Asynchronously downloads PDF.
 */
function loadPdf(pdf){
	toggleNav(true);
	log('Loading files/'+ pdf);
	for (var i = 0; i < canvasArr.length; i++) {
		context[i].clearRect(0, 0, canvasArr[i].width, canvasArr[i].height);
	}
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
	fileEx.hidden = true;
}

