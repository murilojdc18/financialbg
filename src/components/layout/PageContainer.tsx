import { ReactNode } from "react";
import { Breadcrumb } from "./Breadcrumb";

interface PageContainerProps {
  title: string;
  description?: string;
  children?: ReactNode;
}

export function PageContainer({ title, description, children }: PageContainerProps) {
  return (
    <div className="flex-1 p-6 lg:p-8">
      <Breadcrumb />
      
      <div className="mb-8">
        <h1 className="text-2xl lg:text-3xl font-bold text-foreground tracking-tight">
          {title}
        </h1>
        {description && (
          <p className="mt-2 text-muted-foreground">
            {description}
          </p>
        )}
      </div>

      <div className="space-y-6">
        {children}
      </div>
    </div>
  );
}
