/**
 * Classic 3D Chess - Lightweight, self-contained Chess Engine state validator.
 * Built-in support for check, checkmate, stalemate, castling, en passant, and promotion.
 */

class ChessEngine {
    constructor() {
        this.reset();
    }

    reset() {
        // 'w' for White, 'b' for Black
        // Pieces: 'p' (Pawn), 'r' (Rook), 'n' (Knight), 'b' (Bishop), 'q' (Queen), 'k' (King)
        this.board = this.createInitialBoard();
        this.turn = 'w';
        this.castlingRights = {
            w: { kingSide: true, queenSide: true },
            b: { kingSide: true, queenSide: true }
        };
        this.enPassantSquare = null; // { row, col } of the target landing square
        this.lastMove = null; // { from: {row, col}, to: {row, col} }
        this.halfMoveClock = 0;
        this.moveHistory = []; // list of notation or state logs
        this.gameState = 'active'; // 'active', 'checkmate', 'stalemate', 'resign'
        this.winner = null; // 'w', 'b', or 'draw'
    }

    createInitialBoard() {
        const board = Array(8).fill(null).map(() => Array(8).fill(null));
        
        // Define back ranks
        const backRank = ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'];
        
        // Set up Black (row 0: back row, row 1: pawns)
        for (let col = 0; col < 8; col++) {
            board[0][col] = { type: backRank[col], color: 'b' };
            board[1][col] = { type: 'p', color: 'b' };
        }
        
        // Set up White (row 7: back row, row 6: pawns)
        for (let col = 0; col < 8; col++) {
            board[6][col] = { type: 'p', color: 'w' };
            board[7][col] = { type: backRank[col], color: 'w' };
        }
        
        return board;
    }

    getPieceAt(row, col) {
        if (row < 0 || row > 7 || col < 0 || col > 7) return null;
        return this.board[row][col];
    }

    // High level validation: returns list of valid moves for a piece on (row, col)
    // Filtered by canMoveResultWithoutSelfCheck
    getValidMoves(row, col) {
        const piece = this.getPieceAt(row, col);
        if (!piece || piece.color !== this.turn || this.gameState !== 'active') return [];

        const pseudoMoves = this.getPseudoLegalMoves(row, col);
        const validMoves = [];

        for (const move of pseudoMoves) {
            if (!this.doesMoveExposeKing(row, col, move.row, move.col)) {
                validMoves.push(move);
            }
        }

        return validMoves;
    }

    // Helper to see if standard piece move exposes king to check
    doesMoveExposeKing(fromRow, fromCol, toRow, toCol) {
        // Make move on simulated board
        const originalBoardState = this.cloneBoard(this.board);
        const originalCastling = JSON.parse(JSON.stringify(this.castlingRights));
        const originalEP = this.enPassantSquare;

        // Apply simulated move
        const piece = this.board[fromRow][fromCol];
        const targetPiece = this.board[toRow][toCol];

        // Handle simulated en passant capture
        let isEP = false;
        if (piece.type === 'p' && this.enPassantSquare && toRow === this.enPassantSquare.row && toCol === this.enPassantSquare.col) {
            this.board[fromRow][toCol] = null;
            isEP = true;
        }

        this.board[toRow][toCol] = piece;
        this.board[fromRow][fromCol] = null;

        const inCheck = this.isKingInCheck(piece.color);

        // Restore
        this.board = originalBoardState;
        this.castlingRights = originalCastling;
        this.enPassantSquare = originalEP;

        return inCheck;
    }

    isKingInCheck(color) {
        // Find king
        let kingPos = null;
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const p = this.board[r][c];
                if (p && p.type === 'k' && p.color === color) {
                    kingPos = { row: r, col: c };
                    break;
                }
            }
            if (kingPos) break;
        }

        if (!kingPos) return false;

        // Is attacked by opponent
        const opponentColor = color === 'w' ? 'b' : 'w';
        return this.isSquareAttacked(kingPos.row, kingPos.col, opponentColor);
    }

    isSquareAttacked(row, col, attackerColor) {
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const p = this.board[r][c];
                if (p && p.color === attackerColor) {
                    const moves = this.getPseudoLegalMoves(r, c, true); // True to bypass castling recursion
                    for (const move of moves) {
                        if (move.row === row && move.col === col) {
                            return true;
                        }
                    }
                }
            }
        }
        return false;
    }

    getPseudoLegalMoves(row, col, bypassCastling = false) {
        const piece = this.board[row][col];
        if (!piece) return [];

        const moves = [];
        const c = piece.color;
        const oColors = c === 'w' ? 'b' : 'w';

        switch (piece.type) {
            case 'p': {
                const dir = c === 'w' ? -1 : 1;
                const startRank = c === 'w' ? 6 : 1;

                // Single step forward
                if (this.isEmpty(row + dir, col)) {
                    moves.push({ row: row + dir, col: col });
                    // Double step forward
                    if (row === startRank && this.isEmpty(row + 2 * dir, col)) {
                        moves.push({ row: row + 2 * dir, col: col, isDoublePush: true });
                    }
                }

                // Captures
                const captureCols = [col - 1, col + 1];
                for (const nextCol of captureCols) {
                    if (nextCol >= 0 && nextCol <= 7) {
                        const target = this.getPieceAt(row + dir, nextCol);
                        if (target && target.color === oColors) {
                            moves.push({ row: row + dir, col: nextCol });
                        }
                        // En Passant
                        if (this.enPassantSquare && this.enPassantSquare.row === row + dir && this.enPassantSquare.col === nextCol) {
                            moves.push({ row: row + dir, col: nextCol, isENPassant: true });
                        }
                    }
                }
                break;
            }
            case 'r':
                this.addRookMoves(row, col, c, moves);
                break;
            case 'b':
                this.addBishopMoves(row, col, c, moves);
                break;
            case 'q':
                this.addRookMoves(row, col, c, moves);
                this.addBishopMoves(row, col, c, moves);
                break;
            case 'n': {
                const rDiffs = [-2, -2, -1, -1, 1, 1, 2, 2];
                const cDiffs = [-1, 1, -2, 2, -2, 2, -1, 1];
                for (let i = 0; i < 8; i++) {
                    const nRow = row + rDiffs[i];
                    const nCol = col + cDiffs[i];
                    if (this.onBoard(nRow, nCol)) {
                        const target = this.getPieceAt(nRow, nCol);
                        if (!target || target.color !== c) {
                            moves.push({ row: nRow, col: nCol });
                        }
                    }
                }
                break;
            }
            case 'k': {
                const rDiffs = [-1, -1, -1, 0, 0, 1, 1, 1];
                const cDiffs = [-1, 0, 1, -1, 1, -1, 0, 1];
                for (let i = 0; i < 8; i++) {
                    const nRow = row + rDiffs[i];
                    const nCol = col + cDiffs[i];
                    if (this.onBoard(nRow, nCol)) {
                        const target = this.getPieceAt(nRow, nCol);
                        if (!target || target.color !== c) {
                            moves.push({ row: nRow, col: nCol });
                        }
                    }
                }

                // Castling Rights check
                if (!bypassCastling) {
                    this.addCastlingMoves(row, col, c, moves);
                }
                break;
            }
        }

        return moves;
    }

    addRookMoves(row, col, color, moves) {
        const dirs = [
            [-1, 0], [1, 0], [0, -1], [0, 1]
        ];
        for (const [dr, dc] of dirs) {
            let r = row + dr;
            let c = col + dc;
            while (this.onBoard(r, c)) {
                const target = this.board[r][c];
                if (!target) {
                    moves.push({ row: r, col: c });
                } else {
                    if (target.color !== color) {
                        moves.push({ row: r, col: c });
                    }
                    break;
                }
                r += dr;
                c += dc;
            }
        }
    }

    addBishopMoves(row, col, color, moves) {
        const dirs = [
            [-1, -1], [-1, 1], [1, -1], [1, 1]
        ];
        for (const [dr, dc] of dirs) {
            let r = row + dr;
            let c = col + dc;
            while (this.onBoard(r, c)) {
                const target = this.board[r][c];
                if (!target) {
                    moves.push({ row: r, col: c });
                } else {
                    if (target.color !== color) {
                        moves.push({ row: r, col: c });
                    }
                    break;
                }
                r += dr;
                c += dc;
            }
        }
    }

    addCastlingMoves(row, col, color, moves) {
        // Can't castle if in check
        if (this.isKingInCheck(color)) return;

        const rights = this.castlingRights[color];
        const r = color === 'w' ? 7 : 0;

        // King Side Castle (O-O) -> Squares f and g must be free and safe
        if (rights.kingSide) {
            if (this.board[r][5] === null && this.board[r][6] === null) {
                const oppColor = color === 'w' ? 'b' : 'w';
                if (!this.isSquareAttacked(r, 5, oppColor) && !this.isSquareAttacked(r, 6, oppColor)) {
                    moves.push({ row: r, col: 6, isCastleKing: true });
                }
            }
        }

        // Queen Side Castle (O-O-O) -> Squares b, c, d must be free; c, d must be safe
        if (rights.queenSide) {
            if (this.board[r][1] === null && this.board[r][2] === null && this.board[r][3] === null) {
                const oppColor = color === 'w' ? 'b' : 'w';
                if (!this.isSquareAttacked(r, 3, oppColor) && !this.isSquareAttacked(r, 2, oppColor)) {
                    moves.push({ row: r, col: 2, isCastleQueen: true });
                }
            }
        }
    }

    onBoard(r, c) {
        return r >= 0 && r <= 7 && c >= 0 && c <= 7;
    }

    isEmpty(r, c) {
        return this.onBoard(r, c) && this.board[r][c] === null;
    }

    cloneBoard(b) {
        return b.map(row => row.map(item => item ? { ...item } : null));
    }

    /**
     * Executes a move on the board from (fromRow, fromCol) to (toRow, toCol).
     * Automatically handles Pawn Promotion, Castling, En Passant.
     * @returns {Object} info about the move outcome
     */
    move(fromRow, fromCol, toRow, toCol, promotionPiece = 'Q') {
        if (this.gameState !== 'active') return { success: false, reason: 'Game terminated' };

        const piece = this.getPieceAt(fromRow, fromCol);
        if (!piece || piece.color !== this.turn) {
            return { success: false, reason: 'Not matching active player turn' };
        }

        const validMoves = this.getValidMoves(fromRow, fromCol);
        const destinationMove = validMoves.find(m => m.row === toRow && m.col === toCol);
        if (!destinationMove) {
            return { success: false, reason: 'Illegal move configuration' };
        }

        const notationText = this.convertToNotation(fromRow, fromCol, toRow, toCol, destinationMove, piece);
        this.lastMove = { from: { row: fromRow, col: fromCol }, to: { row: toRow, col: toCol } };

        let capture = (this.board[toRow][toCol] !== null);
        let specialAction = null; // 'castle_king', 'castle_queen', 'en_passant', 'promotion'

        // Apply Move
        if (destinationMove.isCastleKing) {
            specialAction = 'castle_king';
            // Move King
            this.board[toRow][toCol] = piece;
            this.board[fromRow][fromCol] = null;
            // Move Rook from col 7 to col 5
            const rook = this.board[toRow][7];
            this.board[toRow][5] = rook;
            this.board[toRow][7] = null;
        } 
        else if (destinationMove.isCastleQueen) {
            specialAction = 'castle_queen';
            // Move King
            this.board[toRow][toCol] = piece;
            this.board[fromRow][fromCol] = null;
            // Move Rook from col 0 to col 3
            const rook = this.board[toRow][0];
            this.board[toRow][3] = rook;
            this.board[toRow][0] = null;
        } 
        else if (destinationMove.isENPassant) {
            specialAction = 'en_passant';
            capture = true;
            // Capture pawn
            this.board[fromRow][toCol] = null; // Square of old pawn
            // Move pawn
            this.board[toRow][toCol] = piece;
            this.board[fromRow][fromCol] = null;
        } 
        else {
            // Check for Pawn Promotion Rank
            const isPromoRank = (piece.type === 'p' && (toRow === 0 || toRow === 7));
            if (isPromoRank) {
                specialAction = 'promotion';
                this.board[toRow][toCol] = { type: promotionPiece.toLowerCase(), color: piece.color };
                this.board[fromRow][fromCol] = null;
            } else {
                // Normal move
                this.board[toRow][toCol] = piece;
                this.board[fromRow][fromCol] = null;
            }
        }

        // En Passant tracking
        if (destinationMove.isDoublePush) {
            const dir = piece.color === 'w' ? -1 : 1;
            this.enPassantSquare = { row: fromRow + dir, col: fromCol };
        } else {
            this.enPassantSquare = null;
        }

        // Castling Rights adjustments
        if (piece.type === 'k') {
            this.castlingRights[piece.color].kingSide = false;
            this.castlingRights[piece.color].queenSide = false;
        }
        else if (piece.type === 'r') {
            if (fromCol === 7) this.castlingRights[piece.color].kingSide = false;
            if (fromCol === 0) this.castlingRights[piece.color].queenSide = false;
        }

        // Adjust if standard rook was captured on original corners
        if (toRow === 0 && toCol === 0) this.castlingRights.b.queenSide = false;
        if (toRow === 0 && toCol === 7) this.castlingRights.b.kingSide = false;
        if (toRow === 7 && toCol === 0) this.castlingRights.w.queenSide = false;
        if (toRow === 7 && toCol === 7) this.castlingRights.w.kingSide = false;

        // Turn Management
        const previousActivePlayer = this.turn;
        this.turn = this.turn === 'w' ? 'b' : 'w';

        // Check for Game Over conditions
        const isGameOver = this.verifyGameOverState();

        this.moveHistory.push({
            notation: notationText,
            from: { row: fromRow, col: fromCol },
            to: { row: toRow, col: toCol },
            piece: piece,
            specialAction: specialAction,
            isCapture: capture,
            promotionTo: specialAction === 'promotion' ? promotionPiece : null
        });

        return {
            success: true,
            player: previousActivePlayer,
            notation: notationText,
            isCapture: capture,
            specialAction: specialAction,
            gameOverState: this.gameState, // 'active', 'checkmate', 'stalemate'
            winner: this.winner
        };
    }

    verifyGameOverState() {
        // Can the active player make any legal move on any piece?
        let hasMoves = false;
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const piece = this.board[r][c];
                if (piece && piece.color === this.turn) {
                    const validMoves = this.getValidMoves(r, c);
                    if (validMoves.length > 0) {
                        hasMoves = true;
                        break;
                    }
                }
            }
            if (hasMoves) break;
        }

        if (!hasMoves) {
            // Is the king in check?
            if (this.isKingInCheck(this.turn)) {
                this.gameState = 'checkmate';
                this.winner = this.turn === 'w' ? 'b' : 'w'; // Opponent wins
            } else {
                this.gameState = 'stalemate';
                this.winner = 'draw';
            }
            return true;
        }
        return false;
    }

    resign(resigningColor) {
        this.gameState = 'resign';
        this.winner = resigningColor === 'w' ? 'b' : 'w';
        return {
            success: true,
            winner: this.winner,
            gameState: this.gameState
        };
    }

    // algebraic conversion helper
    convertToNotation(fromR, fromC, toR, toC, moveData, piece) {
        if (moveData.isCastleKing) return "O-O";
        if (moveData.isCastleQueen) return "O-O-O";

        const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
        const ranks = ['8', '7', '6', '5', '4', '3', '2', '1'];

        const fromNotation = files[fromC] + ranks[fromR];
        const toNotation = files[toC] + ranks[toR];

        let pieceLetter = '';
        if (piece.type !== 'p') {
            pieceLetter = piece.type.toUpperCase();
        }

        let isCapture = (this.board[toR][toC] !== null) || moveData.isENPassant;
        let captureChar = isCapture ? 'x' : '';

        // If pawn and capture, include start file e.g., exd5
        if (piece.type === 'p' && isCapture) {
            pieceLetter = files[fromC];
        }

        let notation = pieceLetter + captureChar + toNotation;

        // Check if movement leads to check/checkmate
        // Simulate Turn Switch for check detection
        const nextOpponent = this.turn === 'w' ? 'b' : 'w';
        
        // Temporarily apply move to detect next checks
        const backupBoard = this.cloneBoard(this.board);
        this.board[toR][toC] = piece;
        this.board[fromR][fromC] = null;
        if (moveData.isENPassant) this.board[fromR][toC] = null;

        // Check checkmate on next player
        let opponentHasNextMoves = false;
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const targetP = this.board[r][c];
                if (targetP && targetP.color === nextOpponent) {
                    const nextValids = [];
                    const pseudo = this.getPseudoLegalMoves(r, c);
                    for (const m of pseudo) {
                        if (!this.doesMoveExposeKing(r, c, m.row, m.col)) {
                            opponentHasNextMoves = true;
                            break;
                        }
                    }
                }
                if (opponentHasNextMoves) break;
            }
            if (opponentHasNextMoves) break;
        }

        const isNextInCheck = this.isKingInCheck(nextOpponent);
        if (isNextInCheck) {
            if (!opponentHasNextMoves) {
                notation += '#'; // Checkmate
            } else {
                notation += '+'; // Check
            }
        }

        // Restore
        this.board = backupBoard;

        return notation;
    }
}