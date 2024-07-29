export class Ref<T> {
    #value: T;

    constructor(value: T) {
        this.#value = value;
    }

    get(): T {
        return this.#value;
    }

    set(value: T): void {
        this.#value = value;
    }
}

export function toSigned(value: number): number {
    while (value >= 128) {
        value -= 256;
    }
    return value;
}

export function toUnsigned(value: number): number {
    return value & 0xFF;
}

export function addWithCarry(left: number, right: number): { carry: boolean, result: number } {
    const sum = left + right;

    return {
        carry: sum > 0xFF,
        result: sum & 0xFF
    };
}

export function subWithCarry(left: number, right: number): { carry: boolean, result: number } {
    const diff = left + (toUnsigned(~right)) + 1;
    return {
        carry: diff > 0xFF,
        result: diff & 0xFF
    };
}

export function checkRange(value: number) {
    if (value < -128 || value > 255) {
        throw new Error(`Value (${value}) is outside of the 8 bit range, the minimum value is -128 and the maximum value is 255`);
    }
}
