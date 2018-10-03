// Get canvas from DOM
let universe = document.getElementById("conway-universe");
let ctx = universe.getContext("2d");

// Prompt user for universe dimensions (default 20)
let universeRows = Number(prompt("How many rows?")) || 20;
let universeColumns = Number(prompt("How many columns?")) || 20;

/*
    Set the length / width of each cell to:
        the smallest dimension between the amount of rows / columns to the screen's length / width
    -25 is to keep a border of minimum 25 px between the canvas and the body element
*/

let cellToScreenRatio = Math.floor(Math.min(
    (window.innerHeight - 25) / universeRows,
    (window.innerWidth - 25) / universeColumns
));

// Store the states of all the cells in a 2d grid mimicking the canvas setup (0 = off, 1 = on)
let currCellStates = [...Array(universeRows)].map(e => Array(universeColumns).fill(0));
// Store the # of neighbours each cell has (0 - 8)
let cellNeighbours = [...Array(universeRows)].map(e => Array(universeColumns).fill(0));
// Store the "active" cells - the cells that were toggled and their 8 neighbours changed from the previous generation
// To be an active cell, either their currCellStates index has changed, or their cellNeighbours count has changed
let affectedCells = {};
// Store the "active" cells of the current generation (the one being calculated / drawn onto canvas at the moment)
let nextAffectedCells = {};
// editMode on means cells can be clicked, and off means the animation is running
let editMode = true;

/*
    A unique modulo funtion is required for cell edgewrap, since the built it % does not handle negatives
    If x is positive:
        (x % y) will be a normal modulo function
        (+ y), then (% y) again, will simply return (x % y), the same as a normal modulo function
    If x is 0:
        (x % y) will equal 0
        (x % y + y) = (0 + y) = y
        (x % y + y) % y = 0 % y = 0
    If x is negative:
        (x % y) = -(|x| % y) in JS, whereas what we want is (-|x| % y), or y - |x| % y ------ true modulo, our goal
            (x % y + y) % y
            = (-(|x| % y) + y) % y
            = (y - (|x| % y)) % y
            = y - (|x| % y) ----- since y - (...) < y, this means y - (...) % y = y - (...)
*/

// The modulo function is necessary for edgewrap, or to map the flat plane onto a torus (donut)
const mod = (x, y) => (x % y + y) % y;

// Define the width and height of the canvas based on the amount of cells and the screen size
universe.width = cellToScreenRatio * universeColumns;
universe.height = cellToScreenRatio * universeRows;

// Draw all cells as a 2d grid
for (let currRow = 0; currRow < universeRows; currRow++) {
    for (let currColumn = 0; currColumn < universeColumns; currColumn++) {
        // Call cell drawing function, specifying x (how many cols across), y (how many rows down), and color
        drawCell(currColumn * cellToScreenRatio, currRow * cellToScreenRatio, "#ebedef");
    }
}

/*
    recalculateNeighbours determines all active cells, and modifies the cellNeighbours count on a cell change.

    0  0  0
    0  0  0
    0  0  0

    In the mini grid above, once the center cell is toggled, the neighbour count of all 8 adjacent cells increases by 1.
    All 9 of the cells above are now active cells, since they have just had a value, state or neighbour count, changed.
    Thus, they have to be stored away to be looped over later.
    Every key in the changeTracker object is a number corresponding to a universe row.
        changeTracker[1] corresponds, to the 2nd grid line (0-indexed), etc.
        Every key m of changeTracker[n], if it exists, corresponds to an active cell at the mth column of the nth row.

    The benefit of storing the active cells means we don't have to loop though every single part of the grid.
    We would only need to check the part where "life", or movement, still exists.
*/

function recalculateNeighbours(cellRow, cellColumn, neighbourStorer, changeTracker, state) {
    // x = +x converts x to an integer
    // These 2 values hold the position, row and column, of the cell in question on the grid
    // This cell, through a user click or a frame update, has just been toggled
    cellRow = +cellRow;
    cellColumn = +cellColumn;

    // Hold the indexes / coordinates of all 8 neighbours of the toggled cell
    let indexes = [
        [cellRow, mod(cellColumn - 1, universeColumns)],                         // Neighbour on rame row, to the left
        [cellRow, mod(cellColumn + 1, universeColumns)],                         // N. on same row, to the right
        [mod(cellRow - 1, universeRows), cellColumn],                            // N. on row above
        [mod(cellRow - 1, universeRows), mod(cellColumn - 1, universeColumns)],  // N. on row above, to the left
        [mod(cellRow - 1, universeRows), mod(cellColumn + 1, universeColumns)],  // N. on row above, to the right
        [mod(cellRow + 1, universeRows), cellColumn],                            // N. on row below
        [mod(cellRow + 1, universeRows), mod(cellColumn - 1, universeColumns)],  // N. on row below, to the left
        [mod(cellRow + 1, universeRows), mod(cellColumn + 1, universeColumns)]   // N. on row below, to the right
    ];

    // Loop over all neighbours of the cell
    // [row, col] are the values of the arrays stored in the indexes array above
    for (let [row, col] of indexes) {
        // The neighbour counters of neighbours of the toggled cell are changed (either +1 or -1), as the cell was changed
        neighbourStorer[row][col] += state;
        // Create a key in the changeTracker abject (either the affectedCells or nextAffectedCells)
        // This key is the row number of the current neighbour being looped through, and its value is a new Object
        // The new Object is assigned to changeTracker[row] if it doesn't exist already
        // The changeTracker objects, again, exist to keep track of all the "active" cells
        changeTracker[row] = changeTracker[row] || {};
        // A key is added to changeTracker[row], its property the column number of the current neighbour of the toggled cell
        // This system stores all active cells in a nested object, following the format obj.cellRow.cellCol
        changeTracker[row][col] = neighbourStorer[row][col];
    }

    // Following the same method above, the cell itself is to be added to the changeTracker object, since it is "active"
    changeTracker[cellRow] = changeTracker[cellRow] || {};
    changeTracker[cellRow][cellColumn] = neighbourStorer[cellRow][cellColumn];
}

// Function to draw a cell onto the grid
function drawCell(x, y, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    // Subtract 1 from the supposed width and height of each cell to leave small gaps in between them
    ctx.rect(x, y, cellToScreenRatio - 1, cellToScreenRatio - 1);
    ctx.fill();
}

// Main function for drawing next frame, and calculating next active (directly affected) cells
function nextUniverseFrame() {
    // Iterate over every row (x) in the grid that include an active cell (stored in affectedCells)
    for (let x of Object.keys(affectedCells)) {
        // Every row stored in the object affectedCells is an object storing column values
        // Every point (x, y) is an active cell (see more at recalculateNeighbours function above)
        for (let y of Object.keys(affectedCells[x])) {
            // If cell is off and has 3 neighbours, it turns on
            if (currCellStates[x][y] === 0 && affectedCells[x][y] === 3) {
                // Turning on
                currCellStates[x][y] = 1;
                // Changing the cell's on-screen display
                drawCell(y * cellToScreenRatio, x * cellToScreenRatio, "#5d6d7e");
                // Since the cell has just changed, its data and its neighbours should again be stored for the next gen
                // This storage will happen in nextAffectedCells, as affectedCells is being iterated over at the moment
                recalculateNeighbours(x, y, cellNeighbours, nextAffectedCells, 1);
                // Continuing the for loop avoids wating time on the bottom if statement
                continue;
            }

            // If cell is on and has either less than 2 or more than 3 neighbours, it dies
            if (currCellStates[x][y] === 1 && affectedCells[x][y] !== 2 && affectedCells[x][y] !== 3) {
                currCellStates[x][y] = 0;
                drawCell(y * cellToScreenRatio, x * cellToScreenRatio, "#ebedef");
                recalculateNeighbours(x, y, cellNeighbours, nextAffectedCells, -1);
                continue;
            }
        }
    }

    // After iterating over affectedCells, the new generation has been drawn, and the next one stored in nextAffectedCells
    // affectedCells is now made into a copy of nextAffectedCells to be iterated over again
    affectedCells = Object.assign({}, nextAffectedCells);
    // nextAffectedCells is emptied, so it is ready to recommence the process of storing active cells
    nextAffectedCells = {};

    // In editMode, users can click to toggle cell states
    if (!editMode) {
        // If editMode mode is off, then prepare to render the next frame of the Game of Life
        window.requestAnimationFrame(nextUniverseFrame);
    }
}

// Detect clicks to toggle cells when in editMode
universe.addEventListener("click", function(e) {
    // Calculate position of mouse relative to canvas
    // Get its position on the full page, and subtract the distance between thecanvas and the page's edge
    let mouseX = e.pageX - universe.offsetLeft;
    let mouseY = e.pageY - universe.offsetTop;
    // Each cell spans cellToScreenRatio pixel. So, dividing the relative mouse position to the cellToScreenRatio gives the row and column of the cell that the mouse is on
    let cellRow = Math.floor(mouseY / cellToScreenRatio);
    let cellColumn = Math.floor(mouseX / cellToScreenRatio);

    // Allow clicks only in editMode
    if (editMode) {
        /*
            Toggles between 0 and 1 states using XOR (^):
            If currCellStates[cellRow][cellColumn] = 1, then 1 ^ 1 = 0
            If currCellStates[cellRow][cellColumn] = 0, then 0 ^ 1 = 1
        */

        currCellStates[cellRow][cellColumn] ^= 1;
        cell = currCellStates[cellRow][cellColumn];

        // Either add 1 ore subtract 1 from the 8 adjacent cells' neighbour counts
        recalculateNeighbours(cellRow, cellColumn, cellNeighbours, affectedCells, cell ? 1 : -1);
        // Redraw the cell, its color depending on its state
        drawCell(cellColumn * cellToScreenRatio, cellRow * cellToScreenRatio, cell ? "#5d6d7e" : "#ebedef");
    }
});

// Detect user clicks
document.addEventListener("keydown", function(e) {
    // Enter ends editMode, and starts running the animation
    if (editMode && e.key === "Enter") {
        editMode = false;
        window.requestAnimationFrame(nextUniverseFrame);
    }

    // p pauses and allows editing to continue
    if (!editMode && e.key === "p") {
        editMode = true;
    }
});
