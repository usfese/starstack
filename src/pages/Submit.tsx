import { ProjectForm } from '../components/ProjectForm';

export function Submit() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">提交项目</h1>
        <p className="mt-1 text-sm text-slate-400">
          填写介绍后本站会自动排队做 AI 质量评估，评估结果会展示在项目页。
        </p>
      </div>
      <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <ProjectForm mode="create" />
      </div>
    </div>
  );
}
