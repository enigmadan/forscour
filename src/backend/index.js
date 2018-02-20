'use strict';
const electron = require('electron');
require('pdfjs-dist');
const fs = require('fs');

const app = electron.app;

// adds debug features like hotkeys for triggering dev tools and reload
require('electron-debug')();


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
	mainWindow = createMainWindow();
});