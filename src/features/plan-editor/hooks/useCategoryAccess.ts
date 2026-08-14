import { useEffect, useState } from "react";
import { getAllowedCategory, getDealCategoryId } from "../../../shared/crm/dealCategory";

/**
 * Проверяет, из той ли воронки открытая сделка.
 *
 * Если ограничение не настроено или что-то не удалось выяснить, доступ
 * разрешается: лучше показать редактор лишний раз, чем запереть работу
 * из-за сбоя portalа.
 */

export type CategoryAccess =
  | { kind: "checking" }
  | { kind: "allowed" }
  | { kind: "blocked"; allowedName: string };

export function useCategoryAccess(enabled: boolean, dealId: string | null): CategoryAccess {
  const [access, setAccess] = useState<CategoryAccess>(enabled ? { kind: "checking" } : { kind: "allowed" });

  useEffect(() => {
    if (!enabled || !dealId) {
      setAccess({ kind: "allowed" });
      return;
    }

    let cancelled = false;
    setAccess({ kind: "checking" });

    const check = async () => {
      try {
        const allowed = await getAllowedCategory();
        if (cancelled) return;

        if (!allowed) {
          setAccess({ kind: "allowed" });
          return;
        }

        const current = await getDealCategoryId(dealId);
        if (cancelled) return;

        setAccess(current === allowed.id ? { kind: "allowed" } : { kind: "blocked", allowedName: allowed.name });
      } catch (error) {
        if (cancelled) return;
        console.warn("Не удалось проверить воронку сделки, показываю редактор.", error);
        setAccess({ kind: "allowed" });
      }
    };

    void check();
    return () => {
      cancelled = true;
    };
  }, [dealId, enabled]);

  return access;
}
