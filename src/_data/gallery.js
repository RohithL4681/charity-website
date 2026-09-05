const captions = {
  'chatgpt-image-aug-13-2026-01-16-35-pm.jpg': 'make it yourself',
  'classroom.jpg': 'After-school study session at our learning centre',
  'diwali.jpg': 'Diwali celebration with children from our programs',
  'health-camp.jpg': 'Free medical check-up camp for senior citizens',
  'meal-drive.jpg': 'Meal kit distribution at Green Park colony',
  'sankalp.jpg': 'Graduation ceremony of our livelihood training batch',
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