const fs = require('fs');
const path = require('path');

// Add captions for your images here, or leave them out and the filename is used.
const captions = {
  'meal-drive.jpg': 'Meal kit distribution at Green Park colony',
  'classroom.jpg': 'After-school study session at our learning centre',
  'health-camp.jpg': 'Free medical check-up camp for senior citizens',
  'sankalp.jpg': 'Graduation ceremony of our livelihood training batch',
  'diwali.jpg': 'Diwali celebration with children from our programs',
  'sports.jpg': 'Annual sports day for sponsored children',
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