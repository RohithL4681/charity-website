module.exports = function (eleventyConfig) {
  // Copy static assets and images as-is
  eleventyConfig.addPassthroughCopy({ 'src/assets': 'assets' });
  eleventyConfig.addPassthroughCopy({ 'src/images': 'images' });
  eleventyConfig.addPassthroughCopy({ 'src/robots.txt': 'robots.txt' });
  eleventyConfig.addPassthroughCopy({ 'src/favicon.svg': 'favicon.svg' });

  // Collections
  eleventyConfig.addCollection('posts', function (collectionApi) {
    return collectionApi
      .getFilteredByGlob('src/posts/*.md')
      .sort(function (a, b) {
        return b.date - a.date;
      });
  });

  eleventyConfig.addCollection('programs', function (collectionApi) {
    return collectionApi
      .getFilteredByGlob('src/_programs/*.md')
      .sort(function (a, b) {
        return a.data.order - b.data.order;
      });
  });

  // Filters
  eleventyConfig.addFilter('readableDate', function (date) {
    return new Date(date).toLocaleDateString('en-GB', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  });

  eleventyConfig.addFilter('limit', function (array, count) {
    return array.slice(0, count);
  });

  eleventyConfig.addFilter('currentYear', function () {
    return new Date().getFullYear();
  });

  // Markdown options
  eleventyConfig.amendLibrary('md', function (mdLib) {
    mdLib.set({
      html: true,
    });
  });

  return {
    dir: {
      input: 'src',
      output: '_site',
      includes: '_includes',
      layouts: '_layouts',
      data: '_data',
    },
    templateFormats: ['njk', 'md', 'html'],
    markdownTemplateEngine: 'njk',
    htmlTemplateEngine: 'njk',
    passthroughFileCopy: true,
  };
};