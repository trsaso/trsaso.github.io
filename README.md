# trsaso.github.io

Saso Trenceski's homepage, served by GitHub Pages from the `master` branch.

- `index.html` is the homepage: markup and styles in one file, no build step, no JavaScript.
- `lidarx/index.html` is LidarX, a point-cloud viewer for lidarx.app. One file, no dependencies. It reads PLY, LAS, XYZ and PTS files in the browser and never uploads them. To serve it at lidarx.app, move the folder to its own repository with a `CNAME` file.
- `Train_YOLO_Models.ipynb` is a Colab notebook linked from the page. Keep its path; the link depends on it.

To change the site, edit `index.html` and push to `master`.
