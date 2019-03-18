'use strict';
const electron = require('electron');
const {ipcMain} = require('electron');
const db = require('./db');
require('pdfjs-dist');
const fs = require('fs');

const app = electron.app;

// adds debug features like hotkeys for triggering dev tools and reload
require('electron-debug')();

var database = null;

// prevent window being garbage collected
let mainWindow;

function onClosed() {
	// dereference the window
	// for multiple windows store them in an array
	mainWindow = null;
}

function createMainWindow() {
	const win = new electron.BrowserWindow({
		width: 600,
		height: 400,
		fullscreen: true
	});

	win.loadURL(`file://${__dirname}/../frontend/index.html`);
	win.setMenu(null);
	win.on('closed', onClosed);

	return win;
}

app.on('window-all-closed', () => {
	if (process.platform !== 'darwin') {
		app.quit();
	}
});

app.on('activate', () => {
	if (!mainWindow) {
		mainWindow = createMainWindow();
	}
});

app.on('ready', () => {
	db.loadDb(databaseCaller);
	mainWindow = createMainWindow();
});

function databaseCaller(err, data = null){
	if(data === null) {
		console.error(err);
	}else{
		database = data;
		mainWindow.webContents.send('begin', database);
		// console.log('hi',database);
	}
}


ipcMain.on('request-init', function(event, arg) {
	console.log('Sending files');
	event.sender.send('send-init', database);
});
ipcMain.on('add-files', function(event, data) {
	console.log('Received files');
	// console.log(data);
	if(!database.pdf){
		database.pdf = [];
	}
	for (var i = 0; i < data.length; i++) {
		// console.log(data[i])
		database.pdf.push(new db.PDF(data[i].name, data[i].path, 0, data[i].length));
	}
	// console.log(database);
	// console.log(database.pdf);
	db.saveDb(errorLogger,database);
	console.log('Sending files');
	event.sender.send('send-db', JSON.stringify(database));
});
function errorLogger(err){
	console.log(err);
}
// .send('onload-user', 'test');
// ipcMain.on('synchronous-message', (event, arg) => {
// 	console.log(arg);  // prints "ping"
// 	event.returnValue = database;
// });