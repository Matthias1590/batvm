import * as helpers from "./helpers.js";

export interface Chars {
    push(): void;
    clear(): void;
    write(char: number): void;
}

export interface NumberDisplay {
    show(value: number): void;
    clear(): void;
    signedMode(): void;
    unsignedMode(): void;
}

export interface Screen {
    setX(value: number): void;
    setY(value: number): void;
    getX(): number;
    getY(): number;
    loadPixel(): number;
    drawPixel(): void;
    clearPixel(): void;
    clear(): void;
    push(): void;
}

export interface Controller {
}

class Register {
    #ref;

    constructor(value: number = 0) {
        this.#ref = new helpers.Ref<number>(value);
    }

    setSigned(value: number): void {
        this.#ref.set(helpers.toSigned(value));
    }

    setUnsigned(value: number): void {
        this.#ref.set(helpers.toUnsigned(value));
    }

    getSigned(): number {
        return helpers.toSigned(this.#ref.get());
    }

    getUnsigned(): number {
        return helpers.toUnsigned(this.#ref.get());
    }
}

class Flags {
    #carry;
    #zero;

    constructor(carry: boolean = false, zero: boolean = false) {
        this.#carry = carry;
        this.#zero = zero;
    }

    setCarry(value: boolean): void {
        this.#carry = value;
    }

    setZero(value: boolean): void {
        this.#zero = value;
    }

    getCarry(): boolean {
        return this.#carry;
    }

    getZero(): boolean {
        return this.#zero;
    }
}

class ZeroRegister extends Register {
    getSigned(): number {
        return 0;
    }

    getUnsigned(): number {
        return 0;
    }
}

interface Instruction {
    run(): void;
}

class Ldi implements Instruction {
    #reg;
    #value;

    constructor(reg: Register, value: number) {
        this.#reg = reg;
        this.#value = value;
    }

    run(): void {
        if (this.#value < 0) {
            this.#reg.setSigned(this.#value);
        } else {
            this.#reg.setUnsigned(this.#value);
        }
    }
}

class Str implements Instruction {
    #memory;
    #destinationAddress;
    #sourceRegister;
    #addressOffset;

    constructor(memory: Memory, destinationAddress: Register, sourceRegister: Register, addressOffset: number) {
        this.#memory = memory;
        this.#destinationAddress = destinationAddress;
        this.#sourceRegister = sourceRegister;

        addressOffset &= 0xF;
        while (addressOffset >= 8) {
            addressOffset -= 16;
        }

        this.#addressOffset = addressOffset;
    }

    run(): void {
        this.#memory.setUnsigned(this.#destinationAddress.getUnsigned() + this.#addressOffset, this.#sourceRegister.getUnsigned());
    }
}

class Lod implements Instruction {
    #memory;
    #sourceAddress;
    #destinationRegister;
    #addressOffset;

    constructor(memory: Memory, sourceAddress: Register, destinationRegister: Register, addressOffset: number) {
        this.#memory = memory;
        this.#sourceAddress = sourceAddress;
        this.#destinationRegister = destinationRegister;

        addressOffset &= 0xF;
        while (addressOffset >= 8) {
            addressOffset -= 16;
        }

        this.#addressOffset = addressOffset;
    }

    run(): void {
        this.#destinationRegister.setUnsigned(this.#memory.getUnsigned(this.#sourceAddress.getUnsigned() + this.#addressOffset));
    }
}

class Cal implements Instruction {
    #stack;
    #pc;
    #functionAddress;

    constructor(stack: Array<number>, pc: Register, functionAddress: number) {
        this.#stack = stack;
        this.#pc = pc;
        this.#functionAddress = functionAddress;
    }

    run(): void {
        if (this.#stack.length >= 32) {
            throw new Error(`Stack overflow`);
        }

        this.#stack.push(this.#pc.getUnsigned());
        this.#pc.setUnsigned(this.#functionAddress - 1);
    }
}

class Adi implements Instruction {
    #flags;
    #reg;
    #imm;

    constructor(flags: Flags, reg: Register, imm: number) {
        this.#flags = flags;
        this.#reg = reg;
        this.#imm = imm;
    }

    run(): void {
        const { result, carry } = helpers.addWithCarry(this.#reg.getUnsigned(), helpers.toUnsigned(this.#imm));

        this.#flags.setCarry(carry);
        this.#flags.setZero(result === 0);

        this.#reg.setUnsigned(result);
    }
}

class Add implements Instruction {
    #flags;
    #regA;
    #regB;
    #regDest;

    constructor(flags: Flags, regA: Register, regB: Register, regDest: Register) {
        this.#flags = flags;
        this.#regA = regA;
        this.#regB = regB;
        this.#regDest = regDest;
    }

    run(): void {
        const { result, carry } = helpers.addWithCarry(this.#regA.getUnsigned(), this.#regB.getUnsigned());

        this.#flags.setCarry(carry);
        this.#flags.setZero(result === 0);

        this.#regDest.setUnsigned(result);
    }
}

class Sub implements Instruction {
    #flags;
    #regA;
    #regB;
    #regDest;

    constructor(flags: Flags, regA: Register, regB: Register, regDest: Register) {
        this.#flags = flags;
        this.#regA = regA;
        this.#regB = regB;
        this.#regDest = regDest;
    }

    run(): void {
        const { result, carry } = helpers.subWithCarry(this.#regA.getUnsigned(), this.#regB.getUnsigned());

        this.#flags.setCarry(carry);
        this.#flags.setZero(result === 0);

        this.#regDest.setUnsigned(result);
    }
}

class And implements Instruction {
    #flags;
    #regA;
    #regB;
    #regDest;

    constructor(flags: Flags, regA: Register, regB: Register, regDest: Register) {
        this.#flags = flags;
        this.#regA = regA;
        this.#regB = regB;
        this.#regDest = regDest;
    }

    run(): void {
        const result = this.#regA.getUnsigned() & this.#regB.getUnsigned();

        this.#flags.setZero(result === 0);

        this.#regDest.setUnsigned(result);
    }
}

class Rsh implements Instruction {
    #regA;
    #regC;

    constructor(regA: Register, regC: Register) {
        this.#regA = regA;
        this.#regC = regC;
    }

    run(): void {
        this.#regC.setUnsigned(this.#regA.getUnsigned() >> 1);
    }
}

class Nor implements Instruction {
    #flags;
    #regA;
    #regB;
    #regDest;

    constructor(flags: Flags, regA: Register, regB: Register, regDest: Register) {
        this.#flags = flags;
        this.#regA = regA;
        this.#regB = regB;
        this.#regDest = regDest;
    }

    run(): void {
        const result = ~(this.#regA.getUnsigned() | this.#regB.getUnsigned());

        this.#flags.setCarry(false);
        this.#flags.setZero(result === 0);

        this.#regDest.setUnsigned(result);
    }
}

class Xor implements Instruction {
    #flags;
    #regA;
    #regB;
    #regDest;

    constructor(flags: Flags, regA: Register, regB: Register, regDest: Register) {
        this.#flags = flags;
        this.#regA = regA;
        this.#regB = regB;
        this.#regDest = regDest;
    }

    run(): void {
        const result = this.#regA.getUnsigned() ^ this.#regB.getUnsigned();

        this.#flags.setZero(result === 0);

        this.#regDest.setUnsigned(result);
    }
}

class Hlt implements Instruction {
    #cpu;

    constructor(cpu: Cpu) {
        this.#cpu = cpu;
    }

    run(): void {
        this.#cpu.halt();
    }
}

class Nop implements Instruction {
    run(): void {
    }
}

class Ret implements Instruction {
    #pc;
    #stack;

    constructor(pc: Register, stack: Array<number>) {
        this.#pc = pc;
        this.#stack = stack;
    }

    run(): void {
        if (this.#stack.length === 0) {
            throw new Error(`Stack underflow`);
        }

        this.#pc.setUnsigned(this.#stack.pop()!);
    }
}

class Jmp implements Instruction {
    #pc;
    #address;

    constructor(pc: Register, address: number) {
        this.#pc = pc;
        this.#address = address;
    }

    run(): void {
        this.#pc.setUnsigned(this.#address - 1);
    }
}

type Condition = "EQ" | "NE" | "Z" | "NZ" | "C" | "NC" | "LT" | "GE";

class Brh implements Instruction {
    #pc;
    #flags;
    #condition;
    #labelAddress;

    constructor(pc: Register, flags: Flags, condition: Condition, labelAddress: number) {
        this.#pc = pc;
        this.#flags = flags;
        this.#condition = condition;
        this.#labelAddress = labelAddress;
    }

    run(): void {
        switch (this.#condition) {
            case "Z":
            case "EQ":
                if (this.#flags.getZero()) {
                    this.#pc.setUnsigned(this.#labelAddress - 1);
                }
                break;
            case "NZ":
            case "NE":
                if (!this.#flags.getZero()) {
                    this.#pc.setUnsigned(this.#labelAddress - 1);
                }
                break;
            case "C":
            case "GE":
                if (this.#flags.getCarry()) {
                    this.#pc.setUnsigned(this.#labelAddress - 1);
                }
                break;
            case "NC":
            case "LT":
                if (!this.#flags.getCarry()) {
                    this.#pc.setUnsigned(this.#labelAddress - 1);
                }
                break;
        }
    }
}

export class Memory {
    #chars;
    #numberDisplay;
    #screen;
    #controller;
    #bytes;

    constructor(chars: Chars, numberDisplay: NumberDisplay, screen: Screen, controller: Controller) {
        this.#chars = chars;
        this.#numberDisplay = numberDisplay;
        this.#screen = screen;
        this.#controller = controller;
        this.#bytes = Array.from({ length: MEMORY_SIZE }, () => new Register());
    }

    setUnsigned(address: number, value: number) {
        this.#bytes[address].setUnsigned(value);
        
        if (address >= 240) {
            switch (address) {
                case 240:
                    this.#screen.setX(value);
                    break;
                case 241:
                    this.#screen.setY(value);
                    break;
                case 242:
                    this.#screen.drawPixel();
                    break;
                case 243:
                    this.#screen.clearPixel();
                    break;
                case 245:
                    this.#screen.push();
                    break;
                case 246:
                    this.#screen.clear();
                    break;
                case 247:
                    this.#chars.write(value);
                    break;
                case 248:
                    this.#chars.push();
                    break;
                case 249:
                    this.#chars.clear();
                    break;
                case 250:
                    this.#numberDisplay.show(value);
                    break;
                case 251:
                    this.#numberDisplay.clear();
                    break;
                case 252:
                    this.#numberDisplay.signedMode();
                    break;
                case 253:
                    this.#numberDisplay.unsignedMode();
                    break;
                default:
                    throw new Error(`TODO: Write to ${address}`);
            }
        }
    }

    setSigned(address: number, value: number) {
        this.#bytes[address].setSigned(value);
    }

    getUnsigned(address: number): number {
        if (address >= 240) {
            switch (address) {
                case 240:
                    return this.#screen.getX();
                case 241:
                    return this.#screen.getY();
                case 244:
                    return this.#screen.loadPixel();
                case 254:
                    return Math.floor(Math.random() * 256);
                default:
                    throw new Error(`TODO: Read from ${address}`);
            }
        }

        return this.#bytes[address].getUnsigned();
    }

    getSigned(address: number): number {
        return this.#bytes[address].getSigned();
    }
}

export const REGISTER_COUNT = 16;
export const MEMORY_SIZE = 256;

class Cpu {
    #program;
    #pc;
    #regs: Array<Register>;
    #mem;
    #stack: Array<number>;
    #flags;
    #halted;

    constructor(program: Array<Instruction>, chars: Chars, numberDisplay: NumberDisplay, screen: Screen, controller: Controller) {
        this.#program = program;

        this.#pc = new Register();
        this.#regs = [new ZeroRegister()]
            .concat(Array.from({ length: 15 }, () => new Register()));
        this.#mem = new Memory(chars, numberDisplay, screen, controller);
        this.#stack = [];
        this.#flags = new Flags();
        this.#halted = false;
    }

    halt() {
        this.#halted = true;
    }

    isHalted() {
        return this.#halted;
    }

    cycle() {
        if (this.#pc.getUnsigned() >= this.#program.length) {
            throw new Error(`Program counter (${this.#pc.getUnsigned()}) is outside of the program (length ${this.#program.length})`);
        }

        // console.log("PC", this.#pc.getUnsigned());
        // console.log("Running", this.#program[this.#pc.getUnsigned()]);

        this.#program[this.#pc.getUnsigned()].run();

        this.#pc.setUnsigned(this.#pc.getUnsigned() + 1);
    }

    getStack(): Array<number> {
        return this.#stack;
    }

    getPc(): Register {
        return this.#pc;
    }

    getFlags(): Flags {
        return this.#flags;
    }

    getMemory(): Memory {
        return this.#mem;
    }

    getRegister(index: number): Register {
        return this.#regs[index];
    }
}

export function assemble(source: string, chars: Chars, numberDisplay: NumberDisplay, screen: Screen, controller: Controller): Cpu {
    const lines = source
        .split("\n")
        .map(l => l.split("//")[0])
        .map(l => l.trim())
        .filter(l => l.length > 0);

    const program: Array<Instruction> = [];
    let address = 0;
    const defer = [];
    const defines: {[name: string]: string} = {
        "pixel_x": "240",
        "pixel_y": "241",
        "draw_pixel": "242",
        "clear_pixel": "243",
        "load_pixel": "244",
        "buffer_screen": "245",
        "clear_screen_buffer": "246",
        "write_char": "247",
        "buffer_chars": "248",
        "clear_chars_buffer": "249",
        "show_number": "250",
        "clear_number": "251",
        "signed_mode": "252",
        "unsigned_mode": "253",
        "rng": "254",
        "controller_input": "255",
    };
    const labels: {[label: string]: number} = {};
    const cpu = new Cpu(program, chars, numberDisplay, screen, controller);

    while (lines.length > 0) {
        const line = lines.shift()!;

        if (line.startsWith(".")) {
            if (line in labels) {
                throw new Error(`Redefinition of label '${line}'`);
            }

            labels[line] = address;
        } else if (line.toUpperCase().startsWith("DEFINE")) {
            const [name, value] = line
                .split(" ")
                .map(p => p.trim())
                .filter(p => p.length > 0)
                .slice(1);

            if (name in defines) {
                throw new Error(`Redefinition of define '${name}'`)
            }

            defines[name] = value;
        } else {
            defer.push(() => assembleInstruction(cpu, line, defines, labels));
            address += 1;
        }
    }

    defer.forEach(d => {
        program.push(d());
    });

    return cpu;
}

function assembleInstruction(cpu: Cpu, line: string, defines: {[name: string]: string}, labels: {[label: string]: number}): Instruction {
    const [opcode, ...args] = line
        .split(" ")
        .map(p => p.trim())
        .filter(p => p.length > 0);

    function expectArg(kind: string, or_throw: boolean = true): string | null {
        if (args.length === 0) {
            if (!or_throw) {
                return null;
            }

            throw new Error(`Expected ${kind} argument but it's missing`);
        }

        let arg = args.shift()!;

        while (arg in defines) {
            arg = defines[arg];
        }
        if (arg in labels) {
            arg = labels[arg].toString();
        }

        return arg;
    }

    function expectRegArg(kind: string, or_throw: boolean = true): Register | null {
        const arg = expectArg(kind, false);
        if (arg === null) {
            if (!or_throw) {
                return null;
            }

            throw new Error(`Expected ${kind} register argument but it's missing`);
        }

        if (arg[0].toUpperCase() != "R") {
            throw new Error(`Register argument must start with 'r'`);
        }

        const index = parseInt(arg.substring(1));
        if (isNaN(index) || index.toString().length !== arg.length - 1) {
            throw new Error(`Expected a register number, '${arg.substring(1)}' is not a number`);
        }

        if (index >= REGISTER_COUNT) {
            throw new Error(`Invalid register number (${index}), the max register number is ${REGISTER_COUNT - 1}`);
        }

        return cpu.getRegister(index);
    }

    function expectIntArg(kind: string, or_throw: boolean = true): number | null {
        const arg = expectArg(kind, false);
        if (arg === null) {
            if (!or_throw) {
                return null;
            }

            throw new Error(`Expected ${kind} integer argument but it's missing`);
        }

        if (arg.length == 3 && ((arg[0] == "'" && arg[2] == "'") || (arg[0] == '"' && arg[2] == '"'))) {
            return arg[1].charCodeAt(0);
        }

        const value = parseInt(arg);
        if (isNaN(value) || value.toString().length !== arg.length) {
            throw new Error(`Expected an integer, '${arg}' is not an integer`);
        }

        helpers.checkRange(value);

        return value;
    }

    function expectSignedIntArg(kind: string, or_throw: boolean = true): number | null {
        const arg = expectArg(kind, false);
        if (arg === null) {
            if (!or_throw) {
                return null;
            }

            throw new Error(`Expected ${kind} signed integer argument but it's missing`);
        }

        if (arg.length == 3 && arg[0] == "'" && arg[2] == "'") {
            return arg[1].charCodeAt(0);
        }

        const value = parseInt(arg);
        if (isNaN(value) || value.toString().length !== arg.length || value != helpers.toSigned(value)) {
            throw new Error(`Expected a signed integer, '${arg}' is not a signed integer`);
        }

        helpers.checkRange(value);

        return value;
    }

    function expectUnsignedIntArg(kind: string, or_throw: boolean = true): number | null {
        const arg = expectArg(kind, false);
        if (arg === null) {
            if (!or_throw) {
                return null;
            }

            throw new Error(`Expected ${kind} unsigned integer argument but it's missing`);
        }

        if (arg.length == 3 && arg[0] == "'" && arg[2] == "'") {
            return arg[1].charCodeAt(0);
        }

        const value = parseInt(arg);
        if (isNaN(value) || value.toString().length !== arg.length || value != helpers.toUnsigned(value)) {
            throw new Error(`Expected an unsigned integer, '${arg}' is not an unsigned integer`);
        }

        helpers.checkRange(value);

        return value;
    }

    function expectConditionArg(kind: string, or_throw: boolean = true): Condition | null {
        const arg = expectArg(kind, false);
        if (arg === null) {
            if (!or_throw) {
                return null;
            }

            throw new Error(`Expected ${kind} condition argument but it's missing`);
        }

        switch (arg.toUpperCase()) {
            case "C":
                return "C";
            case "NC":
                return "NC";
            case "Z":
                return "Z";
            case "NZ":
                return "NZ";
            case "EQ":
                return "EQ";
            case "NE":
                return "NE";
            case "GE":
                return "GE";
            case "LT":
                return "LT";
        }

        throw new Error(`Invalid condition '${arg}', expected 'C' (carry), 'NC' (no carry), 'Z' (zero), 'NZ' (not zero), 'EQ' (equal), 'NE' (not equal), 'GE' (greater or equal), or 'LT' (less than)`);
    }

    function getInstruction() {
        switch (opcode.toUpperCase()) {
            case "LDI":
                return new Ldi(expectRegArg("destination")!, expectIntArg("value")!);
            case "STR":
                return new Str(cpu.getMemory(), expectRegArg("destination address")!, expectRegArg("source")!, expectSignedIntArg("address offset", false) || 0);
            case "CAL":
                return new Cal(cpu.getStack(), cpu.getPc(), expectUnsignedIntArg("function address")!);
            case "ADI":
                return new Adi(cpu.getFlags(), expectRegArg("destination")!, expectIntArg("immediate")!);
            case "INC":
                return new Adi(cpu.getFlags(), expectRegArg("destination")!, 1);
            case "DEC":
                return new Adi(cpu.getFlags(), expectRegArg("destination")!, -1);
            case "BRH":
                return new Brh(cpu.getPc(), cpu.getFlags(), expectConditionArg("branch")!, expectUnsignedIntArg("label address")!);
            case "MOV":
                return new Add(cpu.getFlags(), expectRegArg("source")!, cpu.getRegister(0), expectRegArg("destination")!);
            case "LOD":
                return new Lod(cpu.getMemory(), expectRegArg("source address")!, expectRegArg("destination")!, expectSignedIntArg("address offset", false) || 0);
            case "CMP":
                return new Sub(cpu.getFlags(), expectRegArg("left")!, expectRegArg("right")!, cpu.getRegister(0));
            case "SUB":
                return new Sub(cpu.getFlags(), expectRegArg("left")!, expectRegArg("right")!, expectRegArg("destination")!);
            case "ADD":
                return new Add(cpu.getFlags(), expectRegArg("left")!, expectRegArg("right")!, expectRegArg("destination")!);
            case "AND":
                return new And(cpu.getFlags(), expectRegArg("left")!, expectRegArg("right")!, expectRegArg("destination")!);
            case "NOR":
                return new Nor(cpu.getFlags(), expectRegArg("left")!, expectRegArg("right")!, expectRegArg("destination")!);
            case "NOT":
                return new Nor(cpu.getFlags(), expectRegArg("source")!, cpu.getRegister(0), expectRegArg("destination")!);
            case "XOR":
                return new Xor(cpu.getFlags(), expectRegArg("left")!, expectRegArg("right")!, expectRegArg("destination")!);
            case "HLT":
                return new Hlt(cpu);
            case "RET":
                return new Ret(cpu.getPc(), cpu.getStack());
            case "JMP":
                return new Jmp(cpu.getPc(), expectUnsignedIntArg("label address")!);
            case "LSH":
                const regA = expectRegArg("source")!;
                return new Add(cpu.getFlags(), regA, regA, expectRegArg("destination")!);
            case "RSH":
                return new Rsh(expectRegArg("source")!, expectRegArg("destination")!);
            case "NOP":
                return new Nop();
            default:
                throw new Error(`Unrecognized opcode '${opcode}'`);
        }
    }

    const instruction = getInstruction();

    if (args.length > 0) {
        throw new Error(`Too many arguments, unexpected argument '${args[0]}'`);
    }

    return instruction;
}
