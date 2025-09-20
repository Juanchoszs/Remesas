import { Suspense } from 'react';
import EditorClient from './EditorClient';

export default function Page({ params, searchParams }: { params: { id: string }, searchParams: Record<string, string | string[] | undefined> }) {
  const id = params.id;
  const type = (searchParams?.type as string) || 'FC';
  return (
    <Suspense>
      <EditorClient id={id} type={type} />
    </Suspense>
  );
}
