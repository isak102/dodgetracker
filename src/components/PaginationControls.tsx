"use client";
import { FC } from "react";
import { useRouter } from "next/navigation";
import { Button } from "./Button";

interface PaginationControlsProps {
    currentPage: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
    totalPageCount: number;
}

const PaginationControls: FC<PaginationControlsProps> = ({
    currentPage,
    hasNextPage,
    hasPrevPage,
    totalPageCount,
}) => {
    const router = useRouter();
    const goToPage = (newPage: number) => {
        router.push(`/?page=${newPage}`);
    };

    return (
        <div className="mb-2 flex gap-2">
            <Button
                label="First"
                onClick={() => goToPage(1)}
                disabled={currentPage === 1}
            />
            <Button
                label="&lt;--"
                onClick={() => goToPage(Math.max(currentPage - 1, 1))}
                disabled={!hasPrevPage}
            />

            <div>
                {currentPage} / {totalPageCount}
            </div>

            <Button
                label="--&gt;"
                onClick={() =>
                    goToPage(Math.min(currentPage + 1, totalPageCount))
                }
                disabled={!hasNextPage}
            />
            <Button
                label="Last"
                onClick={() => goToPage(totalPageCount)}
                disabled={currentPage === totalPageCount}
            />
        </div>
    );
};

export default PaginationControls;