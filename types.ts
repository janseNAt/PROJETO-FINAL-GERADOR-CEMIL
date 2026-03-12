/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface SchoolTemplate {
  id: string;
  name: string;
  logoUrl: string;
  headerText: string;
  fontFamily: string;
  margins: {
    top: number;
    bottom: number;
    left: number;
    right: number;
  };
}

export type BlockType = 'text' | 'image' | 'objective' | 'discursive' | 'essay';

export interface ExamBlock {
  id: string;
  type: BlockType;
  content: any;
  position: number;
}

export interface ObjectiveContent {
  question: string;
  alternatives: string[];
  correctIndex: number;
  hasAlternativeE: boolean;
}

export interface DiscursiveContent {
  question: string;
  lines: number;
}

export interface EssayContent {
  rules: string;
  lines: number;
}
