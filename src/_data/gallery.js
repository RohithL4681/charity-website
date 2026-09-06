const fs = require('fs');
const path = require('path');
const captions = {
  'chatgpt-image-aug-13-2026-01-16-35-pm.jpg': 'make it yourself Life of Life',
  'hash-tag-screen.jpg': 'Digital summit',
  'image.jpg': '',
  'images-2.jpg': 'Plant a trees',
  'images-3.jpg': 'Happy weekend Fun',
  'images.jpg': 'Food donation for childerns',
};

module.exports = function () {
  const galleryDir = path.join(__dirname, '..', 'images', 'gallery');
  const files = fs.existsSync(galleryDir) ? fs.readdirSync(galleryDir) : [];

  return files
    .filter(function (file) {
      return /\.(jpe?g|png|gif|webp|svg)$/i.test(file);
    })
    .map(function (file) {
      return {
        src: '/images/gallery/' + file,
        caption:
          captions[file] ||
          file.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' '),
      };
    })
    .sort(function (a, b) {
      return a.src.localeCompare(b.src);
    });
};
