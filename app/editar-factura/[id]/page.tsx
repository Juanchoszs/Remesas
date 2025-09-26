import { Suspense } from 'react';
import EditorClient from './EditorClient';

export default async function Page(
  {
    params,
    searchParams,
  }: {
    params: Promise<{ id: string }>;
    searchParams: Promise<Record<string, string | string[] | undefined>>;
  }
) {
  const { id } = await params;
  const sp = await searchParams;
  const type = (sp?.type as string) || 'FC';
  return (
    <Suspense fallback={null}>
      <EditorClient id={id} type={type} />
    </Suspense>
  );
}
