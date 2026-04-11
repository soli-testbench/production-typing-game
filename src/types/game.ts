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
}
