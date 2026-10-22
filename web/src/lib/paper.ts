export type ExamPaper = { title: string; instructions: string; questions: string[]; sealedAt: string };

export function writePaper(paper: ExamPaper) {
  return JSON.stringify(paper);
}

export function readPaper(text: string): ExamPaper {
  try {
    const value = JSON.parse(text) as Partial<ExamPaper>;
    return { title: String(value.title ?? "Untitled exam"), instructions: String(value.instructions ?? ""), questions: Array.isArray(value.questions) ? value.questions.map(String) : [], sealedAt: String(value.sealedAt ?? "") };
  } catch {
    return { title: "Exam paper", instructions: "", questions: [text], sealedAt: "" };
  }
}
