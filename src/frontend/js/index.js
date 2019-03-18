const fs = require('fs');
const path = require('path');
const electron = require('electron');
const Fuse = require('fuse.js');
const {ipcRenderer} = require('electron')
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

function parentContains(parent, child) {
     var node = child.parentNode;
     while (node != null) {
         if (node == parent) {
             return true;
         }
         node = node.parentNode;
     }
     return false;}
/******************************************/

//request files
ipcRenderer.send('request-init', null);
//initialize frontend
ipcRenderer.on('send-init', function(event, data) {
	log(data);
	if(data && data.pdf){
		setupFiles(data.pdf);
	}else{
		showInstructions();
	}
	setupNav();
	setupPdf();
});
var fuse = null;
function setupFiles(values){
	log(values);
	var options = {
		keys: ['name', 'attributes']
	};
	fuse = new Fuse(values, options)
	setupFilesHelper(fuse.list);
	var fileSearch = document.getElementById("file_search");
	fileSearch.onkeyup = function(e){
		var searched = fuse.search(e.target.value);
		searched = searched.length>0?searched:fuse.list;
		log('searched',searched)
		setupFilesHelper(searched);
	}
}

function setupFilesHelper(fList){
	var fileList = document.getElementById("files_list");
	var html = '';
	log()
	for (var i = 0; i < fList.length; i++) {
		html += '<li><a onclick="loadPdf(\''+ fList[i].src.replace(/\\/g,String.fromCharCode(92,92)) +'\')">'+ fList[i].name +'</a></li>'
		log(fList[i]);
	}
	fileList.innerHTML = html;
}

ipcRenderer.on('send-db', function(event, data) {
	log(JSON.parse(data));
});

function setupPdf(){
	var filePicker = document.getElementById("file");
	filePicker.onchange = function(e){
	    if(e.target.files.length > 0){
	        // File uploaded
	        addPdf(e.target.files);
	    }
	}
}
function addPdf(podf = null){
	if(podf){
		var obj = [];
		for (var i = 0; i < podf.length; i++) {
			obj[i] = {'name':podf[i].name, 'path':podf[i].path, 'length':null};
			log(obj[i]);
		}
		log(JSON.stringify(obj));
		ipcRenderer.send('add-files',obj);
	}else{
		document.getElementById("file").click();
	}
}
function showInstructions(){
	var instr = document.createElement('div');
	instr.innerHTML = '<h1>Use instructions:</h1><br>' +
					  'None as of yet.';
	document.getElementById('canvas-wrap-1').appendChild(instr);
}
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
	}
}

/**
 * Creates directory listing given directory
 */
function setupMenus(){
	// log(ipcRenderer.sendSync('synchronous-message', 'ping')); // prints "pong"
	// const walkSync = (d) => fs.statSync(d).isDirectory() ? fs.readdirSync(d).map(f => walkSync(path.join(d, f))) : d;
	// var files = walkSync('files/');
	// fileEx = document.getElementById('explorer');
	// fileEx.innerHTML = "";

	// for (var i = 0; i < files.length; i++) {
	// 	log(files[i]);
	// 	var file = files[i].split('\\')[1];
	// 	var a = document.createElement('a');
	// 	var linkText = document.createTextNode(file);
	// 	a.appendChild(linkText);
	// 	a.title = file;
	// 	a.href = 'javascript:loadPdf("'+file+'")';
	// 	fileEx.appendChild(a);
	// }
}

// loadPdf('36q.pdf');
var toggled = null;


//TODO: Can probably combine these functions
function toggleNav() {
	if(document.getElementById("nav").style.height != '50px') {
		document.getElementById("nav").style.height = '50px';
	}else if(!toggled) {
		document.getElementById("nav").style.height = '0px';
	}
}
function toggleMenu() {
	if(!toggled){
		toggled = 'Menu';
		document.getElementById("menu").childNodes[1].style.width = '250px';
	}else if(toggled == 'Menu'){
		toggled = null;
		document.getElementById("menu").childNodes[1].style.width = '0px';
	}
}
function toggleFiles() {
	if(!toggled){
		toggled = 'Files';
		document.getElementById("files").childNodes[1].hidden = false;
	}else if(toggled == 'Files') {
		toggled = null;
		document.getElementById("files").childNodes[1].hidden = true;
	}
}
function togglePlaylists() {
	if(!toggled){
		toggled = 'Playlists';
		document.getElementById("playlists").childNodes[1].hidden = false;
	}else if(toggled == 'Playlists') {
		toggled = null;
		document.getElementById("playlists").childNodes[1].hidden = true;
	}
}

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
	touch = new Hammer(touchMe);

	touch.on("swipeleft swiperight tap press", function(ev) {
		if(ev.pointerType=='pen'){
			log('openEditor');
		}else{
			if(ev.type == 'swipeleft'){
				nextPage();
			}else if(ev.type == 'swiperight'){
				prevPage();
			}else if(ev.type == 'tap'){
				switch(ev.target){
					case document.getElementById('prev'):
						prevPage();
						break;
					case document.getElementById('next'):
						nextPage();
						break;
					default:
						if(ev.target.classList.contains('toggleMenu')){
							toggleMenu();
						}else if(ev.target.classList.contains('toggleFiles')){
							toggleFiles();
						}else if(ev.target.classList.contains('togglePlaylists')){
							togglePlaylists();
						}else{
							toggleNav();
							if(toggled){ //TODO: fix this
								log('contained? - ',parentContains(document.getElementsByClassName('toggle'+toggled)[0],ev.target));
								if(!parentContains(document.getElementsByClassName('toggle'+toggled)[0],ev.target)){
									window["toggle"+toggled]();
								}
							}
						}
				}
			}else if(ev.type == 'press'){
				log('openEditor');
			}
		}
		log(ev.target);
	});
	// touch.set({enable: false});
	// toggleNav(false);
}

function toggleTouch(enabled = !navEnabled){
	touch.set({enable: enabled});
	touchL.set({enable: enabled});
	touchR.set({enable: enabled});
	navEnabled = enabled;
}
/**
 * Asynchronously downloads PDF.
 */
function loadPdf(pdf){
	// toggleTouch(true);
	log('Loading: '+ pdf);
	if(toggled){
		window["toggle"+toggled]();
	}
	for (var i = 0; i < canvasArr.length; i++) {
		context[i].clearRect(0, 0, canvasArr[i].width, canvasArr[i].height);
	}
	// If absolute URL from the remote server is provided, configure the CORS
	// header on that server.
	// var url = '//cdn.mozilla.net/pdfjs/tracemonkey.pdf';

	var data = new Uint8Array(fs.readFileSync(pdf));

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
	// fileEx.hidden = true;
}

