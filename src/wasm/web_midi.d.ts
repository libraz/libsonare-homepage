import type { MidiCcBindOptions } from './realtime_engine';
export interface WebMidiEngine {
    bindMidiCc(channel: number, controller: number, paramId: number, options?: MidiCcBindOptions): void;
    setMidiInputSource(destinationId?: number): void;
    clearMidiInputSource(): void;
    pushMidiInputNoteOn(group: number, channel: number, note: number, velocity: number, time?: number): void;
    pushMidiInputNoteOff(group: number, channel: number, note: number, velocity?: number, time?: number): void;
    pushMidiInputCc(group: number, channel: number, controller: number, value: number, time?: number): void;
}
type MidiInputState = 'connected' | 'disconnected';
interface MidiPortLike {
    id: string;
    name?: string | null;
    manufacturer?: string | null;
    state?: MidiInputState;
}
interface MidiMessageEventLike {
    data: ArrayLike<number>;
    timeStamp?: number;
    receivedTime?: number;
    target?: MidiPortLike;
    currentTarget?: MidiPortLike;
}
interface MidiInputLike extends MidiPortLike {
    type?: 'input';
    onmidimessage: ((event: MidiMessageEventLike) => void) | null;
    addEventListener?: (type: 'midimessage', listener: (event: MidiMessageEventLike) => void) => void;
    removeEventListener?: (type: 'midimessage', listener: (event: MidiMessageEventLike) => void) => void;
}
interface MidiConnectionEventLike {
    port?: MidiPortLike | null;
}
interface MidiAccessLike {
    inputs: Map<string, MidiInputLike> | Iterable<[string, MidiInputLike]>;
    onstatechange: ((event: MidiConnectionEventLike) => void) | null;
    addEventListener?: (type: 'statechange', listener: (event: MidiConnectionEventLike) => void) => void;
    removeEventListener?: (type: 'statechange', listener: (event: MidiConnectionEventLike) => void) => void;
}
export interface WebMidiCcBinding {
    channel: number;
    controller: number;
    paramId: number;
    options?: MidiCcBindOptions;
}
export interface WebMidiInputInfo {
    id: string;
    name: string;
    manufacturer: string;
    state: MidiInputState;
}
export interface BindWebMidiOptions {
    /** Realtime-engine MIDI destination receiving the live input source. Default `0`. */
    destinationId?: number;
    /** UMP group used for MIDI 1.0 channel voice events. Default `0`. */
    group?: number;
    /** Restrict binding to specific Web MIDI input ids. Omit or empty = all connected inputs. */
    inputIds?: readonly string[];
    /** Request SysEx-capable access from the browser. Default `false`. */
    sysex?: boolean;
    /** Request software ports from the browser where supported. Default `true`. */
    software?: boolean;
    /** Bind CC-to-parameter mappings before ports are connected. */
    ccBindings?: readonly WebMidiCcBinding[];
    /** Convert a Web MIDI event timestamp to engine port-time samples. */
    timestampToSamples?: (eventTimeMs: number) => number;
    /** Observe hot-plug updates after the helper rebinds matching inputs. */
    onInputsChanged?: (inputs: WebMidiInputInfo[]) => void;
}
export interface WebMidiBinding {
    access: MidiAccessLike;
    inputs(): WebMidiInputInfo[];
    close(): void;
}
export declare function isWebMidiAvailable(): boolean;
export declare function bindWebMidi(engine: WebMidiEngine, options?: BindWebMidiOptions): Promise<WebMidiBinding>;
export {};
