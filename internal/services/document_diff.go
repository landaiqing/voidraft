package services

// Edit 表示编辑操作类型
type EditType int

const (
	// EditInsert 插入操作
	EditInsert EditType = iota
	// EditDelete 删除操作
	EditDelete
	// EditEqual 相等部分
	EditEqual
)

// Edit 表示单个编辑操作
type Edit struct {
	Type    EditType // 操作类型
	Content string   // 操作内容
}

// DiffResult 包含差异比较的结果信息
type DiffResult struct {
	Edits         []Edit // 编辑操作列表
	InsertCount   int    // 插入的字符数
	DeleteCount   int    // 删除的字符数
	ChangedLines  int    // 变更的行数
	TotalChanges  int    // 总变更字符数（插入+删除）
	ChangedTokens int    // 变更的token数（如单词、标识符等）
}

// calculateChangesDetailed 使用Myers差分算法计算两个字符串之间的具体变更
func calculateChangesDetailed(oldText, newText string) DiffResult {
	// 将文本分割成行
	oldLines := splitLines(oldText)
	newLines := splitLines(newText)

	// 计算行级别的差异
	edits := computeLineEdits(oldLines, newLines)

	// 计算变更统计
	result := DiffResult{
		Edits: edits,
	}

	// 统计变更
	for _, edit := range edits {
		switch edit.Type {
		case EditInsert:
			result.InsertCount += len(edit.Content)
			result.ChangedLines++
		case EditDelete:
			result.DeleteCount += len(edit.Content)
			result.ChangedLines++
		}
	}

	result.TotalChanges = result.InsertCount + result.DeleteCount
	result.ChangedTokens = estimateChangedTokens(edits)

	return result
}

// splitLines 将文本分割成行
func splitLines(text string) []string {
	var lines []string
	var currentLine string

	for _, char := range text {
		if char == '\n' {
			lines = append(lines, currentLine)
			currentLine = ""
		} else {
			currentLine += string(char)
		}
	}

	// 添加最后一行（如果不是以换行符结尾）
	if currentLine != "" {
		lines = append(lines, currentLine)
	}

	return lines
}

// computeLineEdits 使用Myers差分算法计算行级别的差异
func computeLineEdits(oldLines, newLines []string) []Edit {
	var edits []Edit

	// 使用Myers差分算法计算行级别的差异
	script := myersDiff(oldLines, newLines)

	// 将差异脚本转换为编辑操作
	for _, op := range script {
		switch op.Type {
		case EditEqual:
			edits = append(edits, Edit{
				Type:    EditEqual,
				Content: oldLines[op.OldStart],
			})
		case EditDelete:
			edits = append(edits, Edit{
				Type:    EditDelete,
				Content: oldLines[op.OldStart],
			})
		case EditInsert:
			edits = append(edits, Edit{
				Type:    EditInsert,
				Content: newLines[op.NewStart],
			})
		}
	}

	return edits
}

// DiffOp 表示差分操作
type DiffOp struct {
	Type     EditType
	OldStart int
	OldEnd   int
	NewStart int
	NewEnd   int
}

// myersDiff 实现Myers差分算法
func myersDiff(oldLines, newLines []string) []DiffOp {
	// 基本思路：Myers差分算法通过建立编辑图来寻找最短编辑路径
	// 简化版实现
	var script []DiffOp

	oldLen := len(oldLines)
	newLen := len(newLines)

	// 使用动态规划找出最长公共子序列(LCS)
	lcs := longestCommonSubsequence(oldLines, newLines)

	// 根据LCS构建差分脚本
	oldIndex, newIndex := 0, 0
	for _, entry := range lcs {
		// 处理LCS之前的差异
		for oldIndex < entry.OldIndex {
			script = append(script, DiffOp{
				Type:     EditDelete,
				OldStart: oldIndex,
				OldEnd:   oldIndex + 1,
				NewStart: newIndex,
				NewEnd:   newIndex,
			})
			oldIndex++
		}

		for newIndex < entry.NewIndex {
			script = append(script, DiffOp{
				Type:     EditInsert,
				OldStart: oldIndex,
				OldEnd:   oldIndex,
				NewStart: newIndex,
				NewEnd:   newIndex + 1,
			})
			newIndex++
		}

		// 处理相等部分
		script = append(script, DiffOp{
			Type:     EditEqual,
			OldStart: oldIndex,
			OldEnd:   oldIndex + 1,
			NewStart: newIndex,
			NewEnd:   newIndex + 1,
		})

		oldIndex++
		newIndex++
	}

	// 处理剩余差异
	for oldIndex < oldLen {
		script = append(script, DiffOp{
			Type:     EditDelete,
			OldStart: oldIndex,
			OldEnd:   oldIndex + 1,
			NewStart: newIndex,
			NewEnd:   newIndex,
		})
		oldIndex++
	}

	for newIndex < newLen {
		script = append(script, DiffOp{
			Type:     EditInsert,
			OldStart: oldIndex,
			OldEnd:   oldIndex,
			NewStart: newIndex,
			NewEnd:   newIndex + 1,
		})
		newIndex++
	}

	return script
}

// LCSEntry 表示最长公共子序列中的一个条目
type LCSEntry struct {
	OldIndex int
	NewIndex int
}

// longestCommonSubsequence 寻找两个字符串数组的最长公共子序列
func longestCommonSubsequence(oldLines, newLines []string) []LCSEntry {
	oldLen := len(oldLines)
	newLen := len(newLines)

	// 创建动态规划表
	dp := make([][]int, oldLen+1)
	for i := range dp {
		dp[i] = make([]int, newLen+1)
	}

	// 填充DP表
	for i := 1; i <= oldLen; i++ {
		for j := 1; j <= newLen; j++ {
			if oldLines[i-1] == newLines[j-1] {
				dp[i][j] = dp[i-1][j-1] + 1
			} else {
				dp[i][j] = max(dp[i-1][j], dp[i][j-1])
			}
		}
	}

	// 回溯找出LCS
	var lcs []LCSEntry
	i, j := oldLen, newLen
	for i > 0 && j > 0 {
		if oldLines[i-1] == newLines[j-1] {
			lcs = append([]LCSEntry{{OldIndex: i - 1, NewIndex: j - 1}}, lcs...)
			i--
			j--
		} else if dp[i-1][j] > dp[i][j-1] {
			i--
		} else {
			j--
		}
	}

	return lcs
}

// max 返回两个整数中的较大值
func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}

// estimateChangedTokens 估计变更的token数量
// 这里使用简单的单词分割来估计
func estimateChangedTokens(edits []Edit) int {
	tokenCount := 0

	for _, edit := range edits {
		switch edit.Type {
		case EditInsert, EditDelete:
			// 简单地将内容按空白字符分割成单词
			words := splitIntoWords(edit.Content)
			tokenCount += len(words)
		}
	}

	return tokenCount
}

// splitIntoWords 将文本分割成单词
func splitIntoWords(text string) []string {
	var words []string
	var currentWord string

	// 简单的状态机:
	// - 如果是字母、数字或下划线，添加到当前单词
	// - 否则，结束当前单词并开始新单词
	for _, char := range text {
		if isWordChar(char) {
			currentWord += string(char)
		} else {
			if currentWord != "" {
				words = append(words, currentWord)
				currentWord = ""
			}
		}
	}

	// 添加最后一个单词（如果有）
	if currentWord != "" {
		words = append(words, currentWord)
	}

	return words
}

// isWordChar 判断字符是否是单词字符（字母、数字或下划线）
func isWordChar(char rune) bool {
	return (char >= 'a' && char <= 'z') ||
		(char >= 'A' && char <= 'Z') ||
		(char >= '0' && char <= '9') ||
		char == '_'
}
