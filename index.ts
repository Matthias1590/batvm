import * as cpu from "./cpu.js";
import * as helpers from "./helpers.js";

class Chars implements cpu.Chars {
    #element;
    #buffer;
    #toPush;

    constructor(element: HTMLElement) {
        this.#element = element;
        this.#buffer = "";
        this.#toPush = "";
    }

    push(): void {
        this.#toPush = this.#buffer;
    }

    clear(): void {
        this.#buffer = "";
    }

    write(char: number): void {
        this.#buffer += String.fromCharCode(char);
    }

    update(): void {
        this.#element.innerText = this.#toPush;
    }
}

class NumberDisplay implements cpu.NumberDisplay {
    #element;
    #signed;
    #toPush: number | null;

    constructor(element: HTMLElement) {
        this.#element = element;
        this.#signed = false;
        this.#toPush = null;
    }

    show(value: number): void {
        this.#toPush = value;
    }

    clear(): void {
        this.#toPush = null;
    }
    
    signedMode(): void {
        this.#signed = true;
    }

    unsignedMode(): void {
        this.#signed = false;
    }

    update(): void {
        if (this.#toPush === null) {
            this.#element.innerText = "";
        } else {
            this.#element.innerText = (this.#signed
                ? helpers.toSigned(this.#toPush)
                : helpers.toUnsigned(this.#toPush))
                .toString();;
        }
    }
}

class Screen implements cpu.Screen {
    #canvas;
    #ctx;
    #x;
    #y;
    #screen;
    #toPush;

    constructor(canvas: HTMLCanvasElement) {
        this.#canvas = canvas;
        this.#ctx = canvas.getContext("2d")!;
        this.#x = 0;
        this.#y = 0;
        this.#screen = Array.from({ length: 32 }, () => Array.from({ length: 32 }, () => false));
        this.#toPush = this.#screen.concat([]);

        this.#ctx.fillStyle = "black";
        this.#ctx.fillRect(0, 0, this.#canvas.width, this.#canvas.height);
    }

    loadPixel(): number {
        if (this.#x >= 32 || this.#y >= 32) {
            return 0;
        }

        return this.#screen[this.#y][this.#x] ? 1 : 0;
    }

    setX(value: number): void {
        this.#x = value & 0b11111;
    }

    getX(): number {
        return this.#x;
    }

    setY(value: number): void {
        this.#y = 31 - (value & 0b11111);
    }

    getY(): number {
        return this.#y;
    }

    drawPixel(): void {
        if (this.#x >= 32 || this.#y >= 32) {
            return;
        }

        this.#screen[this.#y][this.#x] = true;
    }

    clearPixel(): void {
        if (this.#x > 32 || this.#y > 32) {
            return;
        }

        this.#screen[this.#y][this.#x] = false;
    }

    clear(): void {
        this.#screen = Array.from({ length: 32 }, () => Array.from({ length: 32 }, () => false));
    }

    push(): void {
        this.#toPush = this.#screen.concat([]);
    }

    update(): void {
        this.#ctx.fillStyle = "black";
        this.#ctx.fillRect(0, 0, this.#canvas.width, this.#canvas.height);

        for (let y = 0; y < 32; y++) {
            for (let x = 0; x < 32; x++) {
                if (!this.#toPush[y][x]) {
                    continue;
                }

                this.#ctx.fillStyle = "white";
                this.#ctx.fillRect(x, y, 1, 1);
            }
        }
    }
}

const chars = new Chars(document.getElementById("chars")!);
const numberDisplay = new NumberDisplay(document.getElementById("number-display")!);
const screen = new Screen(document.getElementById("screen")! as HTMLCanvasElement);

let vm = cpu.assemble(`
// DVD logo demo

// starting parameters
define BALL_X  2
define BALL_Y  2
define BALL_DX 5
define BALL_DY 4

  ldi r15 buffer_chars
  ldi r1 BALL_X
  ldi r2 BALL_Y
  ldi r3 BALL_DX
  ldi r4 BALL_DY
  ldi r5 128

.loop
  ldi r6 0

  add r1 r3 r1
  add r2 r4 r2

  and r1 r5 r0
  brh z .nrev_X
  sub r0 r3 r3
.nrev_X
  and r2 r5 r0
  brh z .nrev_Y
  sub r0 r4 r4
.nrev_Y

  rsh r1 r6
  rsh r6 r6
  rsh r2 r7
  rsh r7 r7

  str r15 r6 -8
  str r15 r7 -7
  str r15 r0 -2
  str r15 r0 -6
  str r15 r0 -3
  jmp .loop
`, chars, numberDisplay, screen, null!);

const CYCLES_PER_FRAME = 10000;

// ips = fps * cpf
// cpf = ips / fps

function render() {
    if (vm.isHalted()) {
        console.log(vm);
        return;
    }

    try {
        for (let i = 0; i < CYCLES_PER_FRAME && !vm.isHalted(); i++) {
            vm.cycle();
        }
    } catch (e) {
        console.error("PC:", vm.getPc().getUnsigned());
        throw e;
    }

    chars.update();
    numberDisplay.update();
    screen.update();

    requestAnimationFrame(render);
}

window.onload = () => {
    requestAnimationFrame(render);
};

(window as any).vm = vm;
