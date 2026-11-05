export type SurveyStatus = 'draft' | 'active' | 'closed' | 'archived'
export type QuestionType = 'multiple_choice' | 'true_false'

export interface Survey {
  id: string
  title: string
  description: string | null
  status: SurveyStatus
  public_slug: string | null
  created_at: string
  updated_at: string
}

export interface SurveyListItem extends Survey {
  response_count: number
}

export interface Choice {
  id: string
  choice_text: string
  position: number
}

export interface Question {
  id: string
  question_text: string
  question_type: QuestionType
  position: number
  choices: Choice[]
}

export interface SurveyWithQuestions extends Survey {
  questions: Question[]
  response_count: number
}

export type PublicSurveyResult =
  | { status: 'not_found' }
  | { status: 'closed' }
  | {
      status: 'active'
      survey: { id: string; title: string; description: string | null }
      questions: Question[]
    }

export interface ChoiceResult {
  choice_id: string
  choice_text: string
  position: number
  count: number
  percentage: number
}

export interface QuestionResult {
  question_id: string
  question_text: string
  question_type: QuestionType
  position: number
  response_count: number
  unanswered_count: number
  choices: ChoiceResult[]
}

export interface SurveyResults {
  survey_id: string
  title: string
  description: string | null
  status: SurveyStatus
  public_slug: string | null
  created_at: string
  response_count: number
  questions: QuestionResult[]
}
