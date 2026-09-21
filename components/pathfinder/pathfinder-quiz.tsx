"use client";

import { useState } from "react";

import {
  PATHFINDER_QUESTIONS,
  evaluatePathfinder,
  type PathfinderAnswers,
  type PathfinderRecommendation,
} from "@/lib/discovery/pathfinder";
import { Button } from "@/components/ui/button";

export function PathfinderQuiz() {
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Partial<PathfinderAnswers>>({});
  const [recommendations, setRecommendations] = useState<PathfinderRecommendation[] | null>(null);

  const currentQ = PATHFINDER_QUESTIONS[currentStep];
  const isLastQuestion = currentStep === PATHFINDER_QUESTIONS.length - 1;

  const handleSelectOption = (questionId: string, value: string) => {
    const updated = { ...answers, [questionId]: value };
    setAnswers(updated);

    if (!isLastQuestion) {
      setCurrentStep((prev) => prev + 1);
    } else {
      // Completed all questions
      const finalAnswers = updated as PathfinderAnswers;
      const recs = evaluatePathfinder(finalAnswers);
      setRecommendations(recs);
    }
  };

  const handleRestart = () => {
    setAnswers({});
    setCurrentStep(0);
    setRecommendations(null);
  };

  // If quiz is completed, show recommendations
  if (recommendations) {
    const isMinor = answers.situation === "student_minor";

    return (
      <div className="space-y-8 animate-fade-in max-w-4xl mx-auto">
        {/* Results Banner */}
        <div className="bg-white border border-surface-200 rounded-2xl p-6 sm:p-8 text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-50 border border-teal-200 text-teal-700 text-xs font-semibold">
            ✓ Pathfinder Analysis Complete
          </div>
          <h2 className="font-sans text-3xl sm:text-4xl text-navy-900 font-normal">
            Your Recommended Pathways
          </h2>
          <p className="text-surface-600 text-base max-w-xl mx-auto leading-relaxed">
            Based on your work style, interests, and current stage, here are high-demand Nigerian career trajectories tailored to you.
          </p>

          {isMinor && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 text-left max-w-xl mx-auto">
              <strong>Pilot note:</strong> These suggestions focus on education and introductory practice. This experiment does not verify training providers or arrange apprenticeships.
            </div>
          )}

          <div className="pt-2">
            <button
              type="button"
              onClick={handleRestart}
              className="text-xs text-surface-500 hover:text-navy-900 underline font-medium"
            >
              ← Retake questionnaire with different answers
            </button>
          </div>
        </div>

        {/* Recommendations List */}
        <div className="space-y-6">
          {recommendations.map((rec, index) => {
            const { career, matchReasons, recommendedFirstStep } = rec;
            const isTopMatch = index === 0;

            return (
              <article
                key={career.id}
                className={`bg-white border rounded-2xl p-6 sm:p-8 transition-all ${
                  isTopMatch
                    ? "border-teal-500/60 ring-2 ring-teal-500/10"
                    : "border-surface-200"
                }`}
              >
                <div className="space-y-5">
                  {/* Top Match Bar */}
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-2xs font-bold  px-2.5 py-0.5 rounded bg-surface-100 text-navy-900">
                        {career.category}
                      </span>
                      {isTopMatch && (
                        <span className="text-2xs font-bold  px-2.5 py-0.5 rounded bg-teal-50 text-teal-700 border border-teal-200">
                          ★ Strongest Alignment
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-surface-500 font-medium">Fit level:</span>
                      <span className="text-xs font-semibold text-teal-800 bg-teal-50 px-2.5 py-0.5 rounded-full border border-teal-200/70">
                        {rec.matchTier}
                      </span>
                    </div>
                  </div>

                  {/* Title & Tagline */}
                  <div>
                    <h3 className="font-sans text-2xl sm:text-3xl text-navy-900 font-normal">
                      {career.title}
                    </h3>
                    <p className="text-surface-600 text-sm mt-1 leading-relaxed">
                      {career.tagline}
                    </p>
                  </div>

                  {/* Why this matches you */}
                  <div className="bg-surface-50 border border-surface-200 rounded-xl p-4 space-y-2">
                    <p className="text-2xs font-bold  text-surface-500">
                      Why this fits your profile:
                    </p>
                    <ul className="space-y-1 text-xs text-surface-700">
                      {matchReasons.map((reason, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-teal-600 font-bold flex-shrink-0">✓</span>
                          <span>{reason}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Practical Details: Income & Tools */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs py-2 border-y border-surface-100">
                    <div>
                      <span className="text-surface-400 block font-medium mb-0.5">Estimated Nigerian Income:</span>
                      <span className="font-semibold text-navy-900 font-mono text-sm">
                        {career.typicalIncomeRange}
                      </span>
                    </div>
                    <div>
                      <span className="text-surface-400 block font-medium mb-0.5">Essential Tools Required:</span>
                      <span className="text-surface-700">
                        {career.toolsRequired.slice(0, 3).join(", ")}
                      </span>
                    </div>
                  </div>

                  {/* Actionable First Step */}
                  <div className="p-4 rounded-xl bg-teal-50/50 border border-teal-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div>
                      <p className="text-2xs font-bold  text-teal-800">
                        Your Recommended First Action
                      </p>
                      <p className="text-xs text-teal-950 font-medium mt-0.5">
                        {recommendedFirstStep}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 w-full sm:w-auto">
                      <Button
                        href={`/learn?career=${career.slug}`}
                        variant="secondary"
                        size="sm"
                        className="w-full sm:w-auto text-xs"
                      >
                        Start Learning →
                      </Button>
                      <Button
                        href={`/opportunities?career=${career.slug}`}
                        variant="outline"
                        size="sm"
                        className="w-full sm:w-auto text-xs"
                      >
                        Opportunities
                      </Button>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    );
  }

  // Quiz Question View
  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-fade-in">
      {/* Progress Header */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs text-surface-500">
          <span>Question {currentStep + 1} of {PATHFINDER_QUESTIONS.length}</span>
          <span>{Math.round(((currentStep + 1) / PATHFINDER_QUESTIONS.length) * 100)}% completed</span>
        </div>
        <div className="h-1.5 w-full bg-surface-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-teal-600 rounded-full transition-all duration-300"
            style={{ width: `${((currentStep + 1) / PATHFINDER_QUESTIONS.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Question Card */}
      <div className="bg-white border border-surface-200 rounded-2xl p-6 sm:p-8 space-y-6">
        <div className="space-y-2">
          <span className="text-2xs font-bold  text-teal-700">
            Step {currentStep + 1}
          </span>
          <h2 className="font-sans text-2xl sm:text-3xl text-navy-900 font-normal leading-snug">
            {currentQ.title}
          </h2>
          <p className="text-sm text-surface-500 leading-relaxed">
            {currentQ.subtitle}
          </p>
        </div>

        {/* Options */}
        <div className="space-y-3 pt-2">
          {currentQ.options.map((opt) => {
            const isSelected = answers[currentQ.id as keyof PathfinderAnswers] === opt.value;

            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => handleSelectOption(currentQ.id, opt.value)}
                className={`w-full text-left p-4 sm:p-5 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-2 group ${
                  isSelected
                    ? "border-teal-600 bg-teal-50/50 shadow-sm"
                    : "border-surface-200 hover:border-teal-500/50 hover:bg-surface-50"
                }`}
              >
                <div>
                  <p className="text-sm sm:text-base font-semibold text-navy-900 group-hover:text-teal-700 transition-colors">
                    {opt.label}
                  </p>
                  <p className="text-xs text-surface-500 mt-0.5">
                    {opt.hint}
                  </p>
                </div>
                <span className="text-xs font-semibold text-teal-600 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                  Select →
                </span>
              </button>
            );
          })}
        </div>

        {/* Back Button */}
        {currentStep > 0 && (
          <div className="pt-4 border-t border-surface-100">
            <button
              type="button"
              onClick={() => setCurrentStep((prev) => prev - 1)}
              className="text-xs text-surface-500 hover:text-navy-900 font-medium"
            >
              ← Previous Question
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
