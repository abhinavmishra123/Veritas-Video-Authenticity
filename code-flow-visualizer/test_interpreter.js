import { Interpreter } from './engine/interpreter.js';

try {
  const interpreter = new Interpreter();
  interpreter.load('x = 10\nprint(x)');
  while (!interpreter.isFinished()) {
    console.log(interpreter.step());
  }
  console.log("SUCCESS");
} catch (e) {
  console.error("ERROR:", e);
}
