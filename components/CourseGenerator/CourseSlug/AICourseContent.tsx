"use client"

import { useState, useEffect } from "react"
import { Owner, type DBCourse } from "@/types/index"
import { useTranslations } from "next-intl"
import { CourseSidebar } from "./CourseSidebar"
import { CourseHeader } from "./CourseHeader"
import { CourseContent } from "./CourseContent"
import { useCompletion } from "@ai-sdk/react"
import { courseService } from "@/lib/services/course"
import FAQs from "./Faqs"
import ForkBanner from "@/components/ui/fork"
import ChatbotUI from "../CourseDisplay/ChatBot"
import FurtherReading from "./FurtherReading"
import { setCurrentLessonContent, setCurrentLessonTitle } from "@/store/courseSlice"
import { useAppDispatch } from "@/store/hooks"

interface AICourseContentProps {
  courseSlug: string
  course: DBCourse
  isLoading: boolean
  isStreaming?: boolean
  error: string
  onRegenerateOutline: (prompt?: string) => void
}

export function AICourseContent({
  course,
  isStreaming,
  error,
  onRegenerateOutline
}: AICourseContentProps) {
  const [selectedModuleIndex, setSelectedModuleIndex] = useState<number | null>(null)
  const [selectedLessonIndex, setSelectedLessonIndex] = useState<number | null>(null)
  const [lessonContent, setLessonContent] = useState<string>("")
  const [isLoadingLesson, setIsLoadingLesson] = useState(false)
  const [lessonError, setLessonError] = useState("")
  const [regeneratePrompt, setRegeneratePrompt] = useState("")
  const [isRegenerateOpen, setIsRegenerateOpen] = useState(false)
  const [toggleBot, setToggleBot] = useState(false)
  const t = useTranslations()
  const dispatch = useAppDispatch()

  // State to track if the component has mounted
  const [hasMounted, setHasMounted] = useState(false)

  // Setup the completion hook for lesson content generation
  const {
    completion,
    complete,
    isLoading: isCompletionLoading,
    error: completionError,
  } = useCompletion({
    api: "/api/generate-lesson",
    experimental_throttle:500,//This line will remove the error of Maximum update depth exceeded.
  })
  // console.log("Coure FAQ",course.faqs)
  // Effect to set hasMounted to true after the component mounts
  useEffect(() => {
    setHasMounted(true)
  }, [])

  // Effect to update lesson content in real-time as it streams
  useEffect(() => {
    if (!hasMounted) return

    // Update content in real-time as it streams
    if (completion && selectedModuleIndex !== null && selectedLessonIndex !== null) {
      setLessonContent(completion)
      if (!isCompletionLoading && completion) {
        // Save the completed lesson content to the database
        courseService.updateContent(course.id || "", selectedModuleIndex, lessonTitle, completion)
          .then(() => {
            // Update local course data structure to include the content
            if (course.modules && course.modules[selectedModuleIndex] && course.modules[selectedModuleIndex].lessons) {
              const currentLesson = course.modules[selectedModuleIndex].lessons[selectedLessonIndex]
              if (typeof currentLesson === "object") {
                currentLesson.content = completion
              } else {
                // Handle case where lesson might be stored as a string
                course.modules[selectedModuleIndex].lessons[selectedLessonIndex] = {
                  title: currentLesson,
                  content: completion,
                  position: selectedLessonIndex
                }
              }
            }
          })
          .catch(error => {
            console.error('Failed to save lesson content:', error)
            setLessonError('Failed to save lesson content. Please try again.')
          })
      }
    }

    // When loading is complete, mark the lesson as no longer loading
    setIsLoadingLesson(isCompletionLoading)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [completion, isCompletionLoading, hasMounted])

  // Effect to handle completion errors
  useEffect(() => {
    if (!hasMounted) return

    if (completionError) {
      setLessonError(completionError.message || "Failed to generate lesson content")
      setIsLoadingLesson(false)
    }
  }, [completionError, hasMounted])

  // Streaming state with partial content
  if (isStreaming) {
    return (
      <div className="max-w-5xl mx-auto p-4">
        <div className="mb-6">
          <h1 className="text-2xl font-bold flex items-center">
            {course.title || "Generating Course..."}
            <span className="ml-3 inline-block h-4 w-4 rounded-full bg-blue-600 animate-pulse"></span>
          </h1>
          <p className="text-gray-600 mt-2">{t("ai-course-content.generating_course")}</p>
        </div>

        <div className="space-y-4">
          {course?.modules?.length > 0 ? (
            course.modules.map((module, index) => (
              <div key={index} className="border-b border-gray-200 pb-4 last:border-b-0">
                <h2 className="text-lg font-semibold mb-2">
                  {typeof module.title === "string" ? module.title : "Module Title"}
                </h2>
                {module?.lessons?.length > 0 ? (
                  <ul className="list-disc pl-5 space-y-1">
                    {module.lessons.map((lesson, i) => (
                      <li key={i} className="text-gray-700">
                        {typeof lesson === "string" ? lesson : "Lesson Title"}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-sm text-blue-600 animate-pulse">{t("ai-course-content.generating_lessons")}</div>
                )}
              </div>
            ))
          ) : (
            <div className="text-sm text-blue-600 animate-pulse">{t("ai-course-content.generating_lessons")}</div>
          )}
          {course?.modules?.length > 0 && (
            <div className="text-sm text-blue-600 animate-pulse mt-2">{t("ai-course-content.generating_more")}</div>
          )}
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="max-w-5xl mx-auto p-4">
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg p-4 mb-6">
          <h3 className="text-lg font-semibold mb-2">{t("ai-course-content.error_generating_course")}</h3>
          <p>{error}</p>
        </div>
        <button
          onClick={() => onRegenerateOutline()}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          {t("ai-course-content.try_again")}
        </button>
      </div>
    )
  }

  // Calculate progress
  const totalLessons = course?.modules?.reduce((total, module) => total + (module.lessons?.length || 0), 0) || 0
  const completedLessons = course?.done?.length || 0
  const progressPercentage = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0

  // Get current module and lesson titles
  const currentModule = selectedModuleIndex !== null ? course.modules[selectedModuleIndex] : null
  const currentLesson = currentModule && selectedLessonIndex !== null
    ? currentModule.lessons[selectedLessonIndex]
    : null

  const moduleTitle = currentModule
    ? (typeof currentModule.title === "string" ? currentModule.title : "Untitled Module")
    : ""

  const lessonTitle = currentLesson
    ? (typeof currentLesson === "string" ? currentLesson : currentLesson?.title || "Untitled Lesson")
    : ""

useEffect(() => {
  dispatch(setCurrentLessonTitle(lessonTitle));
  dispatch(setCurrentLessonContent(currentLesson?.content || ''));
}, [lessonTitle, currentLesson?.content, dispatch]);

  const handleSelectLesson = async (moduleIndex: number, lessonIndex: number) => {
    setSelectedModuleIndex(moduleIndex)
    setSelectedLessonIndex(lessonIndex)
    const currentModule = course.modules[moduleIndex]
    setLessonError("")

    // Clear previous content
    if (currentModule.lessons[lessonIndex].content) {
      setLessonContent(currentModule.lessons[lessonIndex].content)
    } else {
      const currentLesson = currentModule.lessons[lessonIndex]

      // Handle the lesson if it's an object instead of a string
      const lessonTitle =
        typeof currentLesson === "string" ? currentLesson : currentLesson?.title || "Untitled Lesson"

      // Generate content for this lesson using the completion hook
      setIsLoadingLesson(true)

      // Trigger the completion with the lesson details
      complete("", {
        body: {
          courseId: course.id || "",
          moduleTitle: typeof currentModule.title === "string" ? currentModule.title : "Untitled Module",
          lessonTitle,
        },
      })
    }
  }

  const handleToggleCompletion = (moduleIndex: number, lessonIndex: number) => {
    if (!course.id) return

    // Create a unique ID for this lesson
    const lessonId = `${moduleIndex}-${lessonIndex}`

    // Check if this lesson is already marked as completed
    const isCompleted = course?.done?.includes(lessonId)

    // Update course progress
    import("@/lib/utils/storage").then(({ updateCourseProgress }) => {
      updateCourseProgress(course.id!, lessonId, !isCompleted)
    })

    // Update local state
    const updatedDone = isCompleted ? course?.done?.filter((id) => id !== lessonId) : [...(course.done || []), lessonId]

    course.done = updatedDone
  }

  const handleRegenerateOutline = () => {
    onRegenerateOutline(regeneratePrompt)
    setIsRegenerateOpen(false)
    setRegeneratePrompt("")
  }

  return (
    <div className="w-full mx-auto p-4">
      <div className="flex flex-col md:flex-row gap-6">
        {/* Course Sidebar */}
        <CourseSidebar
          course={course}
          totalLessons={totalLessons}
          progressPercentage={progressPercentage}
          selectedModuleIndex={selectedModuleIndex}
          selectedLessonIndex={selectedLessonIndex}
          setSelectedModuleIndex={setSelectedModuleIndex}
          handleSelectLesson={handleSelectLesson}
          handleToggleCompletion={handleToggleCompletion}
          isRegenerateOpen={isRegenerateOpen}
          setIsRegenerateOpen={setIsRegenerateOpen}
          regeneratePrompt={regeneratePrompt}
          setRegeneratePrompt={setRegeneratePrompt}
          handleRegenerateOutline={handleRegenerateOutline}
        />

        {/* Lesson Content */}
        <div className="md:w-2/3 lg:w-3/4">
          {!course.owners?.includes(Owner.USER) && <ForkBanner courseId={course.id || ""} />}
          {selectedModuleIndex !== null && selectedLessonIndex !== null ? (
            <div className="bg-white rounded-lg shadow-md p-6">
              <CourseHeader
                moduleTitle={moduleTitle}
                lessonTitle={lessonTitle}
              />

              <CourseContent
                lessonContent={lessonContent}
                lessonError={lessonError}
                isLoadingLesson={isLoadingLesson || isCompletionLoading}
                handleSelectLesson={() => handleSelectLesson(selectedModuleIndex, selectedLessonIndex)}
                toggleBot={toggleBot}
                setToggleBot={setToggleBot}
              />
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-md p-6 text-center">
              <svg
                className="w-16 h-16 mx-auto mb-4 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                ></path>
              </svg>
              <h3 className="text-xl font-medium mb-2">{t("ai-course-content.select_lesson_to_begin")}</h3>
              <p className="text-gray-600 mb-4">{t("ai-course-content.click_module_expand")}</p>

            </div>
          )}
          {/* Show FAQs only when no lesson/chapter is open */}
          {selectedModuleIndex === null && selectedLessonIndex === null && (
            <FAQs faqs={course.faqs || []} />
          )}
          <FurtherReading slug={course.slug || ""} />
        </div>

        {/* ChatBot area */}
        {toggleBot && (
          <div className="w-1/3 h-full p-4 sticky top-0">
            <div className="h-full">
              <ChatbotUI />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
