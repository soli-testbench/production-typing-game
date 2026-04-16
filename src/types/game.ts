export interface TroubleCharacter {
  /** The character the player was supposed to type. */
  expected: string;
  /** Total number of times the player mistyped this character. */
  count: number;
  /** The most common incorrect character typed instead of `expected`. */
  mostCommonIncorrect: string;
  /** How many times `mostCommonIncorrect` was typed instead of `expected`. */
  mostCommonIncorrectCount: number;
}

export interface GameResult {
  wpm: number;
  rawWpm: number;
  accuracy: number;
  duration: number;
  correctChars: number;
  incorrectChars: number;
  totalChars: number;
  passage: string;
  wpmSamples: number[];
  gameMode: 'time' | 'words';
  wordCount?: number;
  completionTime?: number;
  practiceMode?: boolean;
  /** Per-expected-character mistype breakdown, sorted by `count` descending. */
  troubleCharacters: TroubleCharacter[];
}
