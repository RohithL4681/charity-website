const captions = {
  'chatgpt-image-aug-13-2026-01-16-35-pm.jpg': 'make it yourself Hii',
  'hash-tag-screen.jpg': 'Digital summit',
  'images-2.jpg': 'Plant a tree',
  'images-3.jpg': 'Happy weekend',
  'images.jpg': 'Food donation',
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
        caption: captions[file] || file.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' '),
      };
    })
    .sort(function (a, b) {
      return a.src.localeCompare(b.src);
    });
};