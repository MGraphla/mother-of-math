import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const interviewCovers = [
  '/covers/cover1.svg',
  '/covers/cover2.svg',
  '/covers/cover3.svg',
  '/covers/cover4.svg',
];

export const getRandomInterviewCover = () => {
  return interviewCovers[Math.floor(Math.random() * interviewCovers.length)];
};
