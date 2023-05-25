document.addEventListener('DOMContentLoaded', function () {
  var desc = document.querySelector('.desc');
  var closeButton = document.querySelector('.close');

  // Show the popup
  desc.style.display = 'block';

  // Close the popup when the close button is clicked
  closeButton.addEventListener('click', function () {
    desc.style.display = 'none';
  });
});

(function () {
  // Class to generate a random masonry layout, using a square grid as base
  class Grid {
    // The constructor receives all the following parameters:
    // - gridSize: The size (width and height) for smallest unit size
    // - gridColumns: Number of columns for the grid (width = gridColumns * gridSize)
    // - gridRows: Number of rows for the grid (height = gridRows * gridSize)
    // - gridMin: Min width and height limits for rectangles (in grid units)
    constructor(gridSize, gridColumns, gridRows, gridMin) {
      this.gridSize = gridSize;
      this.gridColumns = gridColumns;
      this.gridRows = gridRows;
      this.gridMin = gridMin;
      this.rects = [];
      this.currentRects = [
        { x: 0, y: 0, w: this.gridColumns, h: this.gridRows },
      ];
    }

    // Takes the first rectangle on the list, and divides it in 2 more rectangles if possible
    splitCurrentRect() {
      if (this.currentRects.length) {
        const currentRect = this.currentRects.shift();
        const cutVertical = currentRect.w > currentRect.h;
        const cutSide = cutVertical ? currentRect.w : currentRect.h;
        const cutSize = cutVertical ? 'w' : 'h';
        const cutAxis = cutVertical ? 'x' : 'y';
        if (cutSide > this.gridMin * 3) {
          const rect1Size = randomInRange(this.gridMin, cutSide - this.gridMin);
          const rect1 = Object.assign({}, currentRect, {
            [cutSize]: rect1Size,
          });
          const rect2 = Object.assign({}, currentRect, {
            [cutAxis]: currentRect[cutAxis] + rect1Size,
            [cutSize]: currentRect[cutSize] - rect1Size,
          });
          this.currentRects.push(rect1, rect2);
        } else {
          this.rects.push(currentRect);
          this.splitCurrentRect();
        }
      }
    }

    // Call `splitCurrentRect` until there is no more rectangles on the list
    // Then return the list of rectangles
    generateRects() {
      while (this.currentRects.length) {
        this.splitCurrentRect();
      }
      return this.rects;
    }
  }

  // Generate a random integer in the range provided
  function randomInRange(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  // Get canvas view
  const view = document.querySelector('.view');
  // Loaded resources will be here
  const resources = PIXI.Loader.shared.resources;
  // Target for pointer. If down, value is 1, else value is 0
  let pointerDownTarget = 0;
  // Useful variables to keep track of the pointer
  let pointerStart = new PIXI.Point();
  let pointerDiffStart = new PIXI.Point();
  let width, height, app, background, uniforms, diffX, diffY;

  // Variables and settings for grid
  const gridSize = 20;
  const gridMin = 8;
  const imagePadding = 100;
  let gridColumnsCount, gridRowsCount, gridColumns, gridRows, grid;
  let widthRest, heightRest, centerX, centerY, container, rects;
  let images;

  // Set dimensions
  function initDimensions() {
    width = window.innerWidth;
    height = window.innerHeight;
    diffX = 0;
    diffY = 0;
  }

  // Set initial values for uniforms
  function initUniforms() {
    uniforms = {
      uResolution: new PIXI.Point(width, height),
      uPointerDiff: new PIXI.Point(),
      uPointerDown: pointerDownTarget,
    };
  }

  // Initialize the random grid layout
  function initGrid() {
    // Getting columns
    gridColumnsCount = Math.ceil(width / gridSize);
    // Getting rows
    gridRowsCount = Math.ceil(height / gridSize);
    // Make the grid 2 times bigger than viewport, 3.8 if mobile to get
    // similar amount of images
    if (width < height) {
      gridColumns = gridColumnsCount * 2;
      gridRows = gridRowsCount * 2;
    } else {
      gridColumns = gridColumnsCount * 1.2;
      gridRows = gridRowsCount * 1.2;
    }
    // Create a new Grid instance with our settings
    grid = new Grid(gridSize, gridColumns, gridRows, gridMin);
    // Calculate the center position for the grid in the viewport
    widthRest = Math.ceil(gridColumnsCount * gridSize - width);
    heightRest = Math.ceil(gridRowsCount * gridSize - height);
    centerX = (gridColumns * gridSize) / 2 - (gridColumnsCount * gridSize) / 2;
    centerY = (gridRows * gridSize) / 2 - (gridRowsCount * gridSize) / 2;
    // Generate the list of rects
    rects = grid.generateRects();
    // For the list of images
    images = [];
    // For logging how many images are needed in the page
    const numImagesNeeded = grid.rects.length;
    console.log('Number of images needed:', numImagesNeeded);
  }

  // Init the PixiJS Application
  function initApp() {
    // Create a PixiJS Application, using the view (canvas) provided
    app = new PIXI.Application({ view });
    // Resizes renderer view in CSS pixels to allow for resolutions other than 1
    app.renderer.autoDensity = true;
    // Resize the view to match viewport dimensions
    app.renderer.resize(width, height);

    // Set the distortion filter for the entire stage
    const stageFragmentShader =
      document.getElementById('stageFragment').textContent;
    const stageFilter = new PIXI.Filter(
      undefined,
      stageFragmentShader,
      uniforms
    );
    app.stage.filters = [stageFilter];
  }

  // Init the gridded background
  function initBackground() {
    // Create a new empty Sprite and define its size
    background = new PIXI.Sprite();
    background.width = width;
    background.height = height;
    // Get the code for the fragment shader from the loaded resources
    const backgroundFragmentShader =
      document.getElementById('backgroundFragment').textContent;
    // Create a new Filter using the fragment shader
    // We don't need a custom vertex shader, so we set it as `undefined`
    const backgroundFilter = new PIXI.Filter(
      undefined,
      backgroundFragmentShader,
      uniforms
    );
    // Assign the filter to the background Sprite
    background.filters = [backgroundFilter];
    // Add the background to the stage
    app.stage.addChild(background);
  }

  // Initialize a Container element for solid rectangles and images
  function initContainer() {
    container = new PIXI.Container();
    container.interactive = true; // Enable interactivity for the container
    container.cursor = 'pointer'; // Set the cursor style to 'pointer'
    app.stage.addChild(container);
  }

  // Load texture for an image, giving its index
  // Load texture for an image, giving its index
  function loadTextureForImage(index) {
    // Get image Sprite
    const image = images[index];
    // Get the corresponding rect, to store more data needed (it is a normal Object)
    const rect = rects[index];
    // Create a new Image element
    const img = new Image();
    // Set the source to the local image file path
    img.src = `images/image${index}.png`;
    // When the image is loaded
    img.onload = () => {
      // Calculate the aspect ratio of the original image
    const aspectRatio = img.width / img.height;
    // Calculate the image height based on the aspect ratio and the desired width
    const imageHeight = (rect.w * gridSize - imagePadding) / aspectRatio;
    // Set the texture of the image
    image.texture = PIXI.Texture.from(img);
    // Set the width and height of the image
    image.width = rect.w * gridSize - imagePadding;
    image.height = imageHeight;
    // Mark the rect as loaded
    rect.loaded = true;
    // Add a click event listener to the image
    image.interactive = true;
    image.on('click', () => {
      showPopupImage(img.src);
    });
    };
    // When there's an error loading the image
    img.onerror = () => {
      // Mark the rect as not loaded
      rect.loaded = false;
      // Fill the rectangle with the background color
      const graphics = new PIXI.Graphics();
      graphics.beginFill(0xfbfaff);
      graphics.drawRect(image.x, image.y, image.width, image.height);
      graphics.endFill();
      container.addChild(graphics);
    };
  }

  // Add solid rectangles and images
  function initRectsAndImages() {
    // Create a new Graphics element to draw solid rectangles
    const graphics = new PIXI.Graphics();
    // Select the color for rectangles
    graphics.beginFill(0xfbfaff);
    // Loop over each rect in the list
    rects.forEach((rect) => {
      // Create a new Sprite element for each image
      const image = new PIXI.Sprite();
      // Set image's position and size
      image.x = rect.x * gridSize;
      image.y = rect.y * gridSize;
      // Set it's alpha to 0, so it is not visible initially
      image.alpha = 0;
      // Add image to the list
      images.push(image);
      // Draw the rectangle
      graphics.drawRect(image.x, image.y, image.width, image.height);
    });
    // Ends the fill action
    graphics.endFill();
    // Add the graphics (with all drawn rects) to the container
    container.addChild(graphics);
    // Add all image's Sprites to the container
    images.forEach((image) => {
      container.addChild(image);
      image.parentClass = 'image-rect';
    });
  }

  // Check if rects intersects with the viewport
  // and loads corresponding image
  function checkRectsAndImages() {
    // Loop over rects
    rects.forEach((rect, index) => {
      // Get corresponding image
      const image = images[index];
      // Check if the rect intersects with the viewport
      if (rectIntersectsWithViewport(rect)) {
        // If rect just has been discovered
        // start loading image
        if (!rect.discovered) {
          rect.discovered = true;
          loadTextureForImage(index);
        }
        // If image is loaded, increase alpha if possible
        if (rect.loaded && image.alpha < 1) {
          image.alpha += 0.01;
        }
      } else {
        // The rect is not intersecting
        // If the rect was discovered before, but the
        // image is not loaded yet, abort the fetch
        if (rect.discovered && !rect.loaded) {
          rect.discovered = false;
          
        }
        // Decrease alpha if possible
        if (image.alpha > 0) {
          image.alpha -= 0.01;
        }
      }
    });
  }

  // Check if a rect intersects the viewport
  function rectIntersectsWithViewport(rect) {
    return (
      rect.x * gridSize + container.x <= width &&
      0 <= (rect.x + rect.w) * gridSize + container.x &&
      rect.y * gridSize + container.y <= height &&
      0 <= (rect.y + rect.h) * gridSize + container.y
    );
  }

  // Start listening events
  function initEvents() {
    // Make stage interactive, so it can listen to events
    app.stage.interactive = true;

    // Pointer & touch events are normalized into
    // the `pointer*` events for handling different events
    app.stage
      .on('pointerdown', onPointerDown)
      .on('pointerup', onPointerUp)
      .on('pointerupoutside', onPointerUp)
      .on('pointermove', onPointerMove);
  }

  // On pointer down, save coordinates and set pointerDownTarget
  function onPointerDown(e) {
    const { x, y } = e.data.global;
    pointerDownTarget = 1;
    pointerStart.set(x, y);
    pointerDiffStart = uniforms.uPointerDiff.clone();
  }

  // On pointer up, set pointerDownTarget
  function onPointerUp() {
    pointerDownTarget = 0;
  }

  // On pointer move, calculate coordinates diff
  function onPointerMove(e) {
    const { x, y } = e.data.global;
    if (pointerDownTarget) {
      diffX = pointerDiffStart.x + (x - pointerStart.x);
      diffY = pointerDiffStart.y + (y - pointerStart.y);
      diffX =
        diffX > 0
          ? Math.min(diffX, centerX + imagePadding)
          : Math.max(diffX, -(centerX + widthRest));
      diffY =
        diffY > 0
          ? Math.min(diffY, centerY + imagePadding)
          : Math.max(diffY, -(centerY + heightRest));
    }
  }

  function showPopupImage(imageUrl) {
    // Create the popup element
    const popup = document.createElement('div');
    popup.className = 'popup';

    // Create the image element
    const image = document.createElement('img');
    image.src = imageUrl;
    image.className = 'popup-image';

    // Append the image to the popup
    popup.appendChild(image);

    // Add the popup to the document body
    document.body.appendChild(popup);

    // Add the background overlay
    const backgroundOverlay = document.createElement('div');
    backgroundOverlay.className = 'background-overlay';
    document.body.appendChild(backgroundOverlay);

    // Remove the background overlay when the popup is closed
    popup.addEventListener('click', () => {
      document.body.removeChild(popup);
      document.body.removeChild(backgroundOverlay);
    });
  }

  // Init everything
  function init() {
    initDimensions();
    initUniforms();
    initGrid();
    initApp();
    initBackground();
    initContainer();
    initRectsAndImages();
    initEvents();

    // Update the cursor style when hovering over the container
    container
      .on('pointerover', () => {
        container.cursor = 'pointer'; // Set the cursor style to 'pointer'
      })
      .on('pointerout', () => {
        container.cursor = 'default'; // Set the cursor style back to 'default'
      });

    // Animation loop
    // Code here will be executed on every animation frame
    app.ticker.add(() => {
      // Multiply the values by a coefficient to get a smooth animation
      uniforms.uPointerDown +=
        (pointerDownTarget - uniforms.uPointerDown) * 0.075;
      uniforms.uPointerDiff.x += (diffX - uniforms.uPointerDiff.x) * 0.2;
      uniforms.uPointerDiff.y += (diffY - uniforms.uPointerDiff.y) * 0.2;
      // Set position for the container
      container.x = uniforms.uPointerDiff.x - centerX;
      container.y = uniforms.uPointerDiff.y - centerY;
      // Check rects and load/cancel images as needded
      checkRectsAndImages();
    });
  }

  // Clean the current Application
  function clean() {
    // Stop the current animation
    app.ticker.stop();

    // Remove event listeners
    app.stage
      .off('pointerdown', onPointerDown)
      .off('pointerup', onPointerUp)
      .off('pointerupoutside', onPointerUp)
      .off('pointermove', onPointerMove);

    // Abort all fetch calls in progress
    rects.forEach((rect) => {
      if (rect.discovered && !rect.loaded) {
        rect.controller.abort();
      }
    });
  }

  // On resize, reinit the app (clean and init)
  // But first debounce the calls, so we don't call init too often
  let resizeTimer;
  function onResize() {
    if (resizeTimer) clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      clean();
      init();
    }, 200);
  }
  // Listen to resize event
  window.addEventListener('resize', onResize);

  // Init the app
  init();
})();
