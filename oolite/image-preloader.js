var images = {};
function loadImage(url, callback) {
    var image = new Image(); image.src = url;
    images[url] = image;
    image.onload = callback;
}
function loadImages(urls, callback) {
    var count = 0;
    var imagesToLoad = urls.length;
    // Called each time an image finished loading.
    var onImageLoad = function() {
	--imagesToLoad;
	console.log("Loaded " + urls[count++]);
	// If all the images are loaded call the callback.
	if (imagesToLoad == 0) {
	    callback();
	}
    };
    for (var ii = 0; ii < imagesToLoad; ++ii) {
	loadImage(urls[ii], onImageLoad);
    }
}
