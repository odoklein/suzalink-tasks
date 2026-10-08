import "server-only";

import { db } from "@/lib/db";
import { logActivity } from "@/lib/services/activity";
import { parseInput, ServiceError, taskRef, type Actor } from "@/lib/services/core";
import { commentSchema } from "@/lib/validation";

export async function addComment(actor: Actor, raw: { taskId: string; body: string }) {
  const { taskId, body } = parseInput(commentSchema, raw);
  return db.$transaction(async (tx) => {
    const task = await tx.task.findUnique({
      where: { id: taskId },
      include: { project: { select: { key: true } } },
    });
    if (!task) throw new ServiceError("Tâche introuvable.", "NOT_FOUND");
    const comment = await tx.comment.create({ data: { taskId, authorId: actor.userId, body } });
    const ref = taskRef(task.project.key, task.number);
    await logActivity(tx, { projectId: task.projectId, actorId: actor.userId, taskId, message: `a commenté ${ref}` });
    return { comment, ref, task };
  });
}
