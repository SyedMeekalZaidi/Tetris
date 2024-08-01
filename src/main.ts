/**
 * Inside this file you will use the classes and functions from rx.js
 * to add visuals to the svg element in index.html, animate them, and make them interactive.
 *
 * Study and complete the tasks in observable exercises first to get ideas.
 *
 * Course Notes showing Asteroids in FRP: https://tgdwyer.github.io/asteroids/
 *
 * You will be marked on your functional programming style
 * as well as the functionality that you implement.
 *
 * Document your code!
 */

/** Importing */
import "./style.css";

import { BehaviorSubject, Observable, fromEvent, interval, merge } from "rxjs";
import { map, filter, scan, takeWhile, withLatestFrom } from "rxjs/operators";

/** Constansts/Types/Classes */
/** Constants */

// Defining the game screen margins
const Viewport = {
  CANVAS_WIDTH: 200,
  CANVAS_HEIGHT: 400,
  PREVIEW_WIDTH: 160,
  PREVIEW_HEIGHT: 80,
} as const;

// Constant values for the game
const Constants = {
  TICK_RATE_MS: 500 * 1,
  GRID_WIDTH: 10,
  GRID_HEIGHT: 20,
  LEFT_BORDER: 1,
} as const;

const X_SPAWN_POINT = Constants.GRID_WIDTH/2;

// Defining the block that spawns
const Block = {
  WIDTH: Viewport.CANVAS_WIDTH / Constants.GRID_WIDTH, // 200/10 = 20
  HEIGHT: Viewport.CANVAS_HEIGHT / Constants.GRID_HEIGHT, // 400/10 = 20
};

/** User input */

type Key = "KeyS" | "KeyA" | "KeyD" | "KeyW" | "KeyR";

type Event = "keydown" | "keyup" | "keypress";

// Type that defines the state of the game
type State = Readonly<{
  gameEnd: boolean;
  gameBoard: Tetrominos[];
  currentTetrominos: Tetrominos;
  score: number;
  highScore: number;
}>;

type Tetrominos = Readonly<{
  id: number;
  cubes: Cube[];
  color: String;
  x: number;
  y: number;
}>;

type Cube = Readonly<{
  x: number;
  y: number;
}>;

class Tick {
  constructor(public readonly tickElapsed: number) {}
}

abstract class Action {
  constructor(public readonly x: number, public readonly y: number) {}
}

class MoveAction extends Action{
  constructor(public readonly x: number, public readonly y: number) {super(x, y)}
}

class RotateAction extends Action{
  constructor() {super(0, 0)}
}

class Restart extends Action{
  constructor() {super(0, 0)}
}

const defaultTetrominos: Tetrominos[] = [
  { id: 1, cubes: [{ x: 0, y: 0 }, { x:  0, y: -1 }, { x:  1, y: -1 }, { x:  2, y: -1 }], color: "green", x: X_SPAWN_POINT, y: 0,}, //|---
  { id: 1, cubes: [{ x: 0, y: 0 }, { x:  0, y: -1 }, { x: -1, y: -1 }, { x: -2, y: -1 }], color: "white", x: X_SPAWN_POINT, y: 0,}, //---|
  { id: 1, cubes: [{ x: 0, y: 0 }, { x:  1, y:  0 }, { x:  1, y: -1 }, { x:  2, y: -1 }], color: "red", x: X_SPAWN_POINT, y: 0,}, //S
  { id: 1, cubes: [{ x: 0, y: 0 }, { x: -1, y:  0 }, { x: -1, y: -1 }, { x: -2, y: -1 }], color: "pink", x: X_SPAWN_POINT, y: 0,}, //Revere S
  { id: 1, cubes: [{ x: 0, y: 0 }, { x:  0, y: -1 }, { x:  1, y:  0 }, { x:  1, y: -1 }], color: "blue", x: X_SPAWN_POINT, y: 0,}, //2x2 square
  { id: 1, cubes: [{ x: 0, y: 0 }, { x:  1, y:  0 }, { x:  2, y:  0 }, { x:  3, y:  0 }], color: "yellow", x: X_SPAWN_POINT, y: 0,}, //4x1 rectangle
  { id: 1, cubes: [{ x: 0, y: 0 }, { x:  0, y: -1 }, { x:  1, y: -1 }, { x: -1, y: -1 }], color: "purple", x: X_SPAWN_POINT, y: 0,}, //T
]

/** Utility functions */

/**
 * Updates the state by proceeding with one time step.
 *
 * @param s Current state
 * @returns Updated state
 */
const tick = (s: State) => s;

/** Rendering (side effects) */

/**
 * Displays a SVG element on the canvas. Brings to foreground.
 * @param elem SVG element to display
 */
const show = (elem: SVGGraphicsElement) => {
  elem.setAttribute("visibility", "visible");
  elem.parentNode!.appendChild(elem);
};

/**
 * Hides a SVG element on the canvas.
 * @param elem SVG element to hide
 */
const hide = (elem: SVGGraphicsElement) =>
  elem.setAttribute("visibility", "hidden");

/**
 * Creates an SVG element with the given properties.
 *
 * See https://developer.mozilla.org/en-US/docs/Web/SVG/Element for valid
 * element names and properties.
 *
 * @param namespace Namespace of the SVG element
 * @param name SVGElement name
 * @param props Properties to set on the SVG element
 * @returns SVG element
 */
const createSvgElement = (
  namespace: string | null,
  name: string,
  props: Record<string, string> = {}
) => {
  const elem = document.createElementNS(namespace, name) as SVGElement;
  Object.entries(props).forEach(([k, v]) => elem.setAttribute(k, v));
  return elem;
};



/** State */

const createTetrominos = (nextId: number): Tetrominos => {

  const randIndex = Math.floor(Math.random() * defaultTetrominos.length); //Can upgrade to use pure method
  return {
    ...defaultTetrominos[randIndex],
    id: nextId + 1,
  };
};


/** State processing */

const initialGameBoard: Tetrominos[] = [];

// Sets the initial state of the game
const initialState: State = {
  gameEnd: false,
  gameBoard: initialGameBoard,
  currentTetrominos: createTetrominos(1),
  score: 0,
  highScore: 0
} as const;



/** Functions to run game */

const lowestYCube = (tetromino: Tetrominos): Cube => {
  return tetromino.cubes.reduce((minCube, currentCube) =>
    (currentCube.y+tetromino.y) > (tetromino.y + minCube.y) ? currentCube : minCube
  )
};

const isTouchingFloor = (tetromino: Tetrominos): Boolean => {
  if ((lowestYCube(tetromino).y + tetromino.y) < Constants.GRID_HEIGHT) {
    return false;
  }
  return true;
};

const isInBorder = (tetromino: Tetrominos, movement: MoveAction): Boolean => {
  const bool: Boolean = true;
  return tetromino.cubes.every((cube) => {
    const cubeX = tetromino.x + cube.x;
    // console.log(cubeX);
    // const newY = tetromino.y + coor.y;
    return (
      (cubeX > 1 && cubeX < Constants.GRID_WIDTH) || //within border
      (cubeX === 1 && movement.x === 1) || // touching left border and moving right
      (cubeX === Constants.GRID_WIDTH && movement.x === -1) //touching right border and moving left
    )
  })
}; 

const isColliding = (s: State, movement: MoveAction, withMovement: boolean): Boolean => {
  const xMovement = withMovement ? movement.x : 0;
  const yMovement = withMovement ? movement.y : 0;
  const stackingOffset = withMovement ? 0 : 1;

  return s.currentTetrominos.cubes.some(cube => {
    const x = s.currentTetrominos.x + cube.x + xMovement;
    const y = s.currentTetrominos.y + cube.y + yMovement;

    const isOccupied = s.gameBoard.some(tetromino => {
      return tetromino.cubes.some(boardCube => {
        return (tetromino.x + boardCube.x) === x && (tetromino.y + boardCube.y) === y+stackingOffset;
      });
    });
    return isOccupied;
  });

};


const isRowFull = (gameBoard: Tetrominos[], rowIndex: number): Boolean => {
  const colCount = gameBoard.reduce((accumulator, tetromino) => { 
    const rowBlocks = tetromino.cubes.filter((cube) => (tetromino.y + cube.y) === rowIndex) 
    return accumulator + rowBlocks.length;
  }, 0)

  return colCount === Constants.GRID_WIDTH;
};

const isColFull = (gameBoard: Tetrominos[], colIndex: number): Boolean => {
  const colCount = gameBoard.reduce((accumulator, tetromino) => { 
    const colBlocks = tetromino.cubes.filter((cube) => (tetromino.x + cube.x) === colIndex) 
    return accumulator + colBlocks.length;
  }, 0)

  return colCount >= Constants.GRID_HEIGHT;
};

const isGameEnd = (s: State): boolean => {
  const { gameBoard } = s;
  const gridWidth = Constants.GRID_WIDTH;

  // Generate an array of column numbers from 1 to gridWidth
  const columns = Array.from({ length: gridWidth }, (_, index) => index + 1);

  // Check if any column is full
  if (columns.some((col) => isColFull(gameBoard, col))) {
    console.log("column is full");
    return true;
  }

  return false;
};



const getFullRows = (s: State): number[] => {
  const rowCount = Constants.GRID_HEIGHT; // Assuming the grid has a fixed height of 20 rows
  const newState = {...s}

  return Array.from({ length: rowCount }).reduce<number[]>((fullRows, _, rowIndex) => {
    const newRowIndex = rowIndex + 1;
    if (isRowFull(newState.gameBoard, newRowIndex)) {
      fullRows.push(newRowIndex);
    }
    return fullRows;
  }, []);
};


const deleteRow = (s: State, fullRows: number[]): State => {
  // Create a new game board with the cubes removed from the tetrominos in full rows
  const updatedGameBoard = s.gameBoard.map((tetromino) => {
    const updatedCubes = tetromino.cubes.filter(
      (cube) => !fullRows.includes(tetromino.y + cube.y)
    );

    return {
      ...tetromino,
      cubes: updatedCubes,
    };
  });

  // Calculate the new Y positions for the remaining tetrominos
  const numRowsDeleted = fullRows.length;

  // Move down the remaining tetrominos by the number of deleted rows
  const movedTetrominos = updatedGameBoard.map((tetromino, index) => ({
    ...tetromino,
    y: tetromino.y + fullRows.filter((rows) => rows > tetromino.y).length,
  }));

  // Create a new state with the updated game board
  const newState = {
    ...s,
    gameBoard: movedTetrominos, 
    score: s.score + (100 * fullRows.length)
  };

  return newState;

};


const setTetromino = (s: State, movement: Action): Boolean => {
  //If its colliding
    //If it is a vertical collision, stop and create new block
    //If it is a horizontal collision, nullify the movement but keep the current block the same
  if (isTouchingFloor(s.currentTetrominos) || isColliding(s, movement, false)) {
    return true;
  }

  return false;
};

const nextTetromino = (s: State): State => {
  const newState = {
    ...s,
    gameBoard: s.gameBoard.concat(s.currentTetrominos),
    currentTetrominos: createTetrominos(s.currentTetrominos.id),
  };

  return newState;

};  

const rotateTetrominos =  (s: State, rotation: RotateAction): State => {
  if (!(s.currentTetrominos.color === "blue")) {
    const rotatedTetrominosState = {  
      ...s,
      currentTetrominos: {
        ...s.currentTetrominos,
        cubes: s.currentTetrominos.cubes.map((cube) => ({x: -cube.y, y: cube.x}))
      }
    }
  
    if (!isColliding(rotatedTetrominosState, rotation, false) && isInBorder(rotatedTetrominosState.currentTetrominos, rotation)){
      return rotatedTetrominosState;
    } 
  }

  return s;
  
}

const moveTetrominos = (s: State, action: Action): State => {

  if (action instanceof MoveAction){
    if (!isColliding(s, action, true)) {
      const newY = isTouchingFloor(s.currentTetrominos) ? 0 : action.y;
      const newX = isInBorder(s.currentTetrominos, action) ? action.x : 0;
  
      const newState = {
        ...s,
        currentTetrominos: {
          ...s.currentTetrominos,
          x: s.currentTetrominos.x + newX,
          y: s.currentTetrominos.y + newY,
        },
      };
      return newState;
    } else {
      return s;
    }
  } else {
    const rotatedState = rotateTetrominos(s, action);
    return rotatedState;
  }
  
};

const updateState = (s: State, action: Action): State => {
  if (action instanceof Restart){
    return {
      ...initialState,
      highScore: s.score > s.highScore ? s.score : s.highScore,
    };
  } else {  
    const isEnd = isGameEnd(s)
    console.log(isEnd);
    if (isEnd){
      return {
        ...s,
        gameEnd: true
      }
    } 

    const updatedState: State = setTetromino (s, action)
    ? nextTetromino(s) //Create the next tetromino
    : moveTetrominos(s, action); //move the block down by 1
  
    //Check if you can clear a row
    const fullRows = getFullRows(s) 
    if (fullRows.length > 0) {
      return deleteRow(updatedState, fullRows);
    } 

    //Clear the row, return new state
    return updatedState;
  }
  
};

/**
 * This is the function called on page load. Your main game loop
 * should be called here.
 */
export function main() {
  // Canvas elements
  const svg = document.querySelector("#svgCanvas") as SVGGraphicsElement &
    HTMLElement;
  const preview = document.querySelector("#svgPreview") as SVGGraphicsElement &
    HTMLElement;
  const gameover = document.querySelector("#gameOver") as SVGGraphicsElement &
    HTMLElement;
  const container = document.querySelector("#main") as HTMLElement;

  svg.setAttribute("height", `${Viewport.CANVAS_HEIGHT}`);
  svg.setAttribute("width", `${Viewport.CANVAS_WIDTH}`);
  preview.setAttribute("height", `${Viewport.PREVIEW_HEIGHT}`);
  preview.setAttribute("width", `${Viewport.PREVIEW_WIDTH}`);

  // Text fields
  const scoreText = document.querySelector("#scoreText") as HTMLElement;
  const highScoreText = document.querySelector("#highScoreText") as HTMLElement;


  /** Observables */

  /** User input */

  // An observable that converts keypress event into an observable
  const key$ = fromEvent<KeyboardEvent>(document, "keypress");

  /**
   * Function that filters key$ observable to only include
   * keypresses matching keyCode provided
   */
  const fromKey = (keyCode: Key) =>
    key$.pipe(
      filter(({ code }) => code === keyCode)
    );

  const movementFromKey = (keycode: Key, x: number, y: number) => {
    return fromKey(keycode).pipe(
      map(() => new MoveAction(x, y)),
    )
  }

  // Observables keypresses for "A", "D", "S"
  const left$ = movementFromKey("KeyA", -1, 0);
  const right$ = movementFromKey("KeyD", 1, 0);
  const down$ = movementFromKey("KeyS", 0, 1);
  const rotate$ = fromKey("KeyW").pipe(map(() => new RotateAction()));
  const restart$ = fromKey("KeyR").pipe(map(() => new Restart()));
  /** Tick related Observables */

  /** Determines the rate of time steps */
  const tick$ = interval(Constants.TICK_RATE_MS).pipe(
    map(() => new MoveAction(0, 1))
  );

  /** Rendering */
  const clearCanvas = (svg: SVGGraphicsElement, gameEnd: boolean) => {
    if (!gameEnd) {
      Array.from(svg.childNodes).forEach((childNode) => {
        if (childNode instanceof SVGRectElement) {
          svg.removeChild(childNode);
        }
      });
    }
  };

  const renderTetromino = (svg: SVGGraphicsElement, tetromino: Tetrominos) => {
    const currentTetrominos = { ...tetromino };

    currentTetrominos.cubes.forEach((coor) => {
      const cube = createSvgElement(svg.namespaceURI, "rect", {
        height: `${Block.HEIGHT}`,
        width: `${Block.WIDTH}`,
        x: `${Block.WIDTH * (currentTetrominos.x - 1 + coor.x)}`,
        y: `${Block.HEIGHT * (currentTetrominos.y - 1 + coor.y)}`,
        style: `fill: ${currentTetrominos.color}`,
      });
      svg.appendChild(cube);
    });
  };

  const renderGrid = (svg: SVGGraphicsElement, gameBoard: Tetrominos[]) => {
    gameBoard.forEach((tetromino) => {
      renderTetromino(svg, tetromino);
    });
  };

  /**
   * Renders the current state to the canvas.
   *
   * In MVC terms, this updates the View using the Model.
   *
   * @param s Current state
   */
  const render = (s: State) => {
    clearCanvas(svg, s.gameEnd);
    renderTetromino(svg, s.currentTetrominos);
    renderGrid(svg, s.gameBoard);
    scoreText.textContent = `${s.score}`;
    highScoreText.textContent = `${s.highScore}`;
  };



  /**
   * Observable: the main game loop.
   * Only emits data each tick
   * Updates the state of the game using scan
   * Then renders those changes
   * Checks if the game is over or not
   *
   */
  
  const source$ = merge(right$, left$, down$, rotate$, restart$, tick$)
    .pipe(
      scan(
        (s: State, action: Action) => updateState(s, action),
        initialState
      )
    )
    .subscribe((s: State) => {
      render(s);

      if (s.gameEnd) {
        show(gameover);
      } else {
        hide(gameover);
      }
    });
}

// The following simply runs your main function on window load.  Make sure to leave it in place.
if (typeof window !== "undefined") {
  window.onload = () => {
    main();
  };
}
