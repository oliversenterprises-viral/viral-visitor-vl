-- =============================================
-- SAFE UNDO SCRIPT - Remove Demo Data Only
-- =============================================
-- 
-- Purpose: Removes only the seeded demo referrals we added before launch.
-- This will NOT delete any real referrals.
--
-- Instructions:
-- 1. Run Step 1 first to preview what will be deleted.
-- 2. Run Step 2 (optional) to see how many real referrals exist.
-- 3. Run the DELETE inside the transaction.
-- 4. Review the result, then either COMMIT or ROLLBACK.

-- STEP 1: Preview exactly what will be deleted (run this first)
SELECT 
    id,
    referrer_code,
    referred_email,
    created_at
FROM referrals 
WHERE referrer_code IN ('sarah_m', 'james_t', 'maria_k', 'david_r', 'emma_l', 'noah_p')
ORDER BY created_at DESC;

-- STEP 2: (Optional) Check how many real referrals exist
SELECT COUNT(*) AS real_referrals 
FROM referrals 
WHERE referrer_code NOT IN ('sarah_m', 'james_t', 'maria_k', 'david_r', 'emma_l', 'noah_p');

-- STEP 3: Delete the demo data inside a transaction (safe)
BEGIN;

DELETE FROM referrals 
WHERE referrer_code IN ('sarah_m', 'james_t', 'maria_k', 'david_r', 'emma_l', 'noah_p');

-- After running the DELETE above, review how many rows were deleted.
-- If everything looks correct, run this to permanently delete:
-- COMMIT;

-- If something looks wrong, run this to cancel everything:
-- ROLLBACK;
