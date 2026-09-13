import { googleSiteVerificationResponse } from './_lib/gsc';

export const onRequestGet: PagesFunction = async () => googleSiteVerificationResponse();
