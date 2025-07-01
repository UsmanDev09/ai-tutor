"use client"

import { useTranslations } from "next-intl"
import { parseContentFromMarkdown } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { FlaskConical } from "lucide-react"
import { useState, useEffect } from "react"
import TestMyKnowledge from "../CourseDisplay/TestMyKnowledge"
import { ChatButton } from "../CourseControls/ChatButton"
import FAQs from "./Faqs"

interface CourseContentProps {
  lessonContent: string
  lessonError: string
  isLoadingLesson: boolean
  handleSelectLesson: () => void
  toggleBot: boolean
  setToggleBot: (value: boolean) => void
}

interface FAQ {
  question: string
  answer: string
}

// Util: Extract FAQ from markdown text
function extractFAQsFromMarkdown(content: string): { question: string; answer: string }[] {
  // Match all potential FAQ heading variations (case-insensitive)
  const faqStartRegex = /(##?\s*)?(FAQs|FAQ|Frequently Asked Questions|Common Questions)/i;
  const splitContent = content.split(faqStartRegex);

  // If nothing matched, bail
  if (splitContent.length < 2) return [];

  // Get everything after the heading
  const faqSection = splitContent.slice(-1)[0];

  const questionAnswerRegex = /Q:\s*(.*?)\s*A:\s*(.*?)(?=(Q:|$))/gs;
  const faqs: { question: string; answer: string }[] = [];

  let match;
  while ((match = questionAnswerRegex.exec(faqSection)) !== null) {
    // Remove leading/trailing ** and whitespace, then wrap in <b>...</b>
    let question = match[1].trim();
    let answer = match[2].trim();
    // Remove leading/trailing ** and whitespace from question and answer
    question = question.replace(/^\*\*\s*/, '').replace(/\s*\*\*$/, '');
    answer = answer.replace(/^\*\*\s*/, '').replace(/\s*\*\*$/, '');
    // Wrap question in <b>...</b>
    question = `<b>${question}</b>`;
    // Optionally, you can also bold the answer if you want:
    // answer = `<b>${answer}</b>`;
    if (question && answer) {
      faqs.push({ question, answer });
    }
  }

  return faqs;
}


export function CourseContent({
  lessonContent,
  lessonError,
  isLoadingLesson,
  handleSelectLesson,
  toggleBot,
  setToggleBot
}: CourseContentProps) {
  const t = useTranslations()
  const [testMyKnowledgeToggle, setTestMyKnowledgeToggle] = useState<boolean>(false)

  // Extract FAQ separately
  const faqs = extractFAQsFromMarkdown(lessonContent)

  // Remove FAQ from lesson content before parsing markdown
  const contentWithoutFAQ = lessonContent.split(/(##?\s*)?(FAQs|FAQ|Frequently Asked Questions|Common Questions)/i)[0];


  // Convert markdown to HTML
  const parsedContent = parseContentFromMarkdown(contentWithoutFAQ)

  useEffect(() => {
    setTestMyKnowledgeToggle(false); // hide the quiz when lesson changes
  }, [lessonContent]);

  if (lessonError) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg p-4">
        <h3 className="text-lg font-semibold mb-2">{t("ai-course-content.error_loading_lesson")}</h3>
        <p>{lessonError}</p>
        <button
          onClick={handleSelectLesson}
          className="mt-3 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 text-sm"
        >
          {t("ai-course-content.try_again_short")}
        </button>
      </div>
    )
  }

  const handleTestMyKnowledgeToggle = () => {
    setTestMyKnowledgeToggle(!testMyKnowledgeToggle)
  }

  return (
    <>
      <div className="prose prose-blue max-w-none">
        <ChatButton toggleBot={toggleBot} setToggleBot={setToggleBot} />

        {lessonContent ? (
          <div className="relative">
            <div dangerouslySetInnerHTML={{ __html: parsedContent }} />
            {isLoadingLesson && (
              <span className="inline-block h-5 w-2 bg-blue-500 animate-pulse ml-0.5 align-bottom"></span>
            )}
          </div>
        ) : isLoadingLesson ? (
          <div className="animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-full mb-3"></div>
            <div className="h-4 bg-gray-200 rounded w-full mb-3"></div>
            <div className="h-4 bg-gray-200 rounded w-5/6 mb-3"></div>
            <div className="h-4 bg-gray-200 rounded w-full mb-6"></div>
            <div className="h-4 bg-gray-200 rounded w-full mb-3"></div>
            <div className="h-4 bg-gray-200 rounded w-4/5 mb-6"></div>
          </div>
        ) : (
          <p className="text-gray-500">{t("ai-course-content.no_content_available")}</p>
        )}
      </div>

      {!isLoadingLesson && (
        testMyKnowledgeToggle && lessonContent?.trim() ? (
          <div className="mt-12">
            <TestMyKnowledge key={lessonContent} lessonContent={lessonContent} />
          </div>
        ) : (
          <Button
            variant="default"
            disabled={!lessonContent.trim()}
            onClick={handleTestMyKnowledgeToggle}
          >
            <FlaskConical className="mr-2" />
            {t('lesson-content.testKnowledgeButton')}
          </Button>
        )
      )}


      {faqs.length > 0 && (
        <div className="mt-10">
          <FAQs faqs={faqs} />
        </div>
      )}
    </>
  )
}
export default CourseContent