// Deep Hierarchical DSA Patterns Data Module - Global Variable
window.dsaData = {
  categories: [
    {
      id: "array",
      name: "Array",
      color: "#8B5CF6", // Purple
      children: [
        {
          name: "Two Pointer",
          children: [
            {
              id: "arr-2p-opposite",
              name: "Opposite ends (left + right)",
              isPattern: true,
              difficulty: "Easy",
              desc: "Two pointers start on opposite ends and move inwards. Crucial for sorted arrays to search pairs or validate palindromes.",
              problems: ["LeetCode 167: Two Sum II", "LeetCode 125: Valid Palindrome", "LeetCode 11: Container With Most Water"],
              snippet: `def two_sum_opposite(arr, target):
    left, right = 0, len(arr) - 1
    while left < right:
        curr_sum = arr[left] + arr[right]
        if curr_sum == target:
            return [left, right]
        elif curr_sum < target:
            left += 1
        else:
            right -= 1
    return []`
            },
            {
              id: "arr-2p-samedir",
              name: "Same direction (fast & slow pointers)",
              isPattern: true,
              difficulty: "Easy",
              desc: "Two pointers move at different rates or offsets in the same direction. Useful for removing duplicates or partitioning in-place.",
              problems: ["LeetCode 26: Remove Duplicates", "LeetCode 283: Move Zeroes", "LeetCode 80: Remove Duplicates II"],
              snippet: `def move_zeroes(nums):
    slow = 0
    for fast in range(len(nums)):
        if nums[fast] != 0:
            nums[slow], nums[fast] = nums[fast], nums[slow]
            slow += 1`
            },
            {
              id: "arr-2p-dutch",
              name: "Partition / Dutch flag",
              isPattern: true,
              difficulty: "Medium",
              desc: "Maintains three pointers (low, mid, high) to group elements into three separate ranges in O(N) time and O(1) space.",
              problems: ["LeetCode 75: Sort Colors", "LeetCode 905: Sort Array By Parity"],
              snippet: `def sort_colors(nums):
    low, mid, high = 0, 0, len(nums) - 1
    while mid <= high:
        if nums[mid] == 0:
            nums[low], nums[mid] = nums[mid], nums[low]
            low += 1; mid += 1
        elif nums[mid] == 1:
            mid += 1
        else:
            nums[mid], nums[high] = nums[high], nums[mid]
            high -= 1`
            }
          ]
        },
        {
          name: "Sliding Window",
          children: [
            {
              id: "arr-sw-fixed",
              name: "Fixed Size",
              isPattern: true,
              difficulty: "Easy",
              desc: "Maintains a fixed subsegment width K as it slides across the array, tracking statistics on elements entering and leaving.",
              problems: ["LeetCode 643: Maximum Average Subarray I", "LeetCode 1456: Maximum Vowels in Substring"],
              snippet: `def max_vowels_fixed(s, k):
    vowels = set("aeiou")
    curr_count = sum(1 for c in s[:k] if c in vowels)
    max_count = curr_count
    for i in range(k, len(s)):
        if s[i] in vowels: curr_count += 1
        if s[i - k] in vowels: curr_count -= 1
        max_count = max(max_count, curr_count)
    return max_count`
            },
            {
              name: "Variable Size",
              children: [
                {
                  id: "arr-sw-expand",
                  name: "Expand–Shrink",
                  isPattern: true,
                  difficulty: "Medium",
                  desc: "Expands the right bound to add elements, and shrinks the left bound dynamically when constraints are violated.",
                  problems: ["LeetCode 209: Minimum Size Subarray Sum", "LeetCode 3: Longest Substring Without Repeating Characters"],
                  snippet: `def min_subarray_len(target, nums):
    left, curr_sum = 0, 0
    min_len = float('inf')
    for right in range(len(nums)):
        curr_sum += nums[right]
        while curr_sum >= target:
            min_len = min(min_len, right - left + 1)
            curr_sum -= nums[left]
            left += 1
    return min_len if min_len != float('inf') else 0`
                },
                {
                  id: "arr-sw-mono",
                  name: "Monotonic Window",
                  isPattern: true,
                  difficulty: "Hard",
                  desc: "Combines a sliding window with a monotonic deque to fetch extreme boundary values inside window frames in O(1) time.",
                  problems: ["LeetCode 239: Sliding Window Maximum", "LeetCode 1438: Longest Continuous Subarray Limit"],
                  snippet: `from collections import deque
def max_sliding_window(nums, k):
    q = deque()
    res = []
    for i, x in enumerate(nums):
        while q and nums[q[-1]] <= x: q.pop()
        q.append(i)
        if q[0] == i - k: q.popleft()
        if i >= k - 1: res.append(nums[q[0]])
    return res`
                }
              ]
            }
          ]
        },
        {
          name: "Prefix Based",
          children: [
            {
              id: "arr-pre-sum",
              name: "Prefix Sum",
              isPattern: true,
              difficulty: "Easy",
              desc: "Precomputes aggregate sums to answer subarray range queries [L, R] in O(1) time.",
              problems: ["LeetCode 303: Range Sum Query", "LeetCode 525: Contiguous Array", "LeetCode 560: Subarray Sum Equals K"],
              snippet: `class NumArray:
    def __init__(self, nums):
        self.prefix = [0] * (len(nums) + 1)
        for i in range(len(nums)):
            self.prefix[i + 1] = self.prefix[i] + nums[i]
    def sum_range(self, left, right):
        return self.prefix[right + 1] - self.prefix[left]`
            },
            {
              id: "arr-pre-xor",
              name: "Prefix XOR",
              isPattern: true,
              difficulty: "Medium",
              desc: "Tracks cumulative XOR outputs to support range XOR sweeps and bitwise complement lookups in constant time.",
              problems: ["LeetCode 1310: XOR Queries of a Subarray", "LeetCode 1442: Count Triplets XOR"],
              snippet: `def xor_queries(arr, queries):
    prefix = [0] * (len(arr) + 1)
    for i in range(len(arr)):
        prefix[i + 1] = prefix[i] ^ arr[i]
    return [prefix[r + 1] ^ prefix[l] for l, r in queries]`
            },
            {
              id: "arr-pre-2d",
              name: "2D Prefix",
              isPattern: true,
              difficulty: "Hard",
              desc: "Precomputes matrix area ranges, supporting subgrid summation updates in constant time.",
              problems: ["LeetCode 304: Range Sum Query 2D - Immutable"],
              snippet: `class NumMatrix:
    def __init__(self, matrix):
        R, C = len(matrix), len(matrix[0])
        self.dp = [[0] * (C + 1) for _ in range(R + 1)]
        for r in range(R):
            for c in range(C):
                self.dp[r+1][c+1] = matrix[r][c] + self.dp[r][c+1] + self.dp[r+1][c] - self.dp[r][c]
    def sum_region(self, r1, c1, r2, c2):
        return self.dp[r2+1][c2+1] - self.dp[r1][c2+1] - self.dp[r2+1][c1] + self.dp[r1][c1]`
            }
          ]
        },
        {
          name: "Kadane's / Subarray",
          children: [
            {
              id: "arr-kad-maxsum",
              name: "Max subarray sum (Kadane's)",
              isPattern: true,
              difficulty: "Medium",
              desc: "Maintains a running maximum sum. Resets current sum to 0 if it dips negative. Updates a global max.",
              problems: ["LeetCode 53: Maximum Subarray", "LeetCode 918: Maximum Sum Circular Subarray"],
              snippet: `def max_subarray(nums):
    max_so_far = curr = nums[0]
    for x in nums[1:]:
        curr = max(x, curr + x)
        max_so_far = max(max_so_far, curr)
    return max_so_far`
            },
            {
              id: "arr-kad-maxprod",
              name: "Max product subarray",
              isPattern: true,
              difficulty: "Medium",
              desc: "Maintains running minimum and maximum products at each node to handle double negative product inversions.",
              problems: ["LeetCode 152: Maximum Product Subarray"],
              snippet: `def max_product(nums):
    res = max(nums)
    curr_min = curr_max = 1
    for x in nums:
        if x == 0:
            curr_min = curr_max = 1
            continue
        tmp = curr_max * x
        curr_max = max(x * curr_max, x * curr_min, x)
        curr_min = min(tmp, x * curr_min, x)
        res = max(res, curr_max)
    return res`
            },
            {
              id: "arr-kad-xor",
              name: "Subarray with given XOR / sum",
              isPattern: true,
              difficulty: "Medium",
              desc: "Pairs cumulative prefix XOR counts inside hash maps to locate count target intervals matching X ^ Y = Target.",
              problems: ["LeetCode 560: Subarray Sum Equals K", "GeeksforGeeks: Subarrays with XOR K"],
              snippet: `def subarrays_with_xor(arr, k):
    prefix_counts = {0: 1}
    curr_xor = 0
    ans = 0
    for x in arr:
        curr_xor ^= x
        target = curr_xor ^ k
        if target in prefix_counts:
            ans += prefix_counts[target]
        prefix_counts[curr_xor] = prefix_counts.get(curr_xor, 0) + 1
    return ans`
            }
          ]
        },
        {
          name: "Binary Search",
          children: [
            {
              id: "arr-bs-index",
              name: "on index",
              isPattern: true,
              difficulty: "Easy",
              desc: "Performs O(log N) splits on sorted indices using lower/upper bounds based on median values.",
              problems: ["LeetCode 704: Binary Search", "LeetCode 34: Find First and Last Position"],
              snippet: `def binary_search(arr, target):
    l, r = 0, len(arr) - 1
    while l <= r:
        mid = l + (r - l) // 2
        if arr[mid] == target: return mid
        elif arr[mid] < target: l = mid + 1
        else: r = mid - 1
    return -1`
            },
            {
              id: "arr-bs-answer",
              name: "on answer",
              isPattern: true,
              difficulty: "Hard",
              desc: "Searches an abstract continuous answer space utilizing monotonic validation checks to minimize/maximize configurations.",
              problems: ["LeetCode 875: Koko Eating Bananas", "LeetCode 1011: Capacity To Ship Packages"],
              snippet: `def can_ship(capacity, weights, days):
    curr, count = 0, 1
    for w in weights:
        if curr + w > capacity:
            count += 1; curr = w
        else: curr += w
    return count <= days`
            }
          ]
        }
      ]
    },
    {
      id: "string",
      name: "String",
      color: "#EC4899", // Pink
      children: [
        {
          name: "Sliding Window",
          children: [
            {
              id: "str-sw-unique",
              name: "Longest substring without repeat",
              isPattern: true,
              difficulty: "Medium",
              desc: "Maintains a sliding window where duplicates shrink the left border dynamically to ensure unique elements.",
              problems: ["LeetCode 3: Longest Substring Without Repeating Characters"],
              snippet: `def length_of_longest_substring(s):
    seen = {}
    l = max_len = 0
    for r, c in enumerate(s):
        if c in seen and seen[c] >= l:
            l = seen[c] + 1
        seen[c] = r
        max_len = max(max_len, r - l + 1)
    return max_len`
            },
            {
              id: "str-sw-min",
              name: "Minimum window substring",
              isPattern: true,
              difficulty: "Hard",
              desc: "Maintains character counts inside a sliding window, expanding rightwards to find match requirements and shrinking leftwards to trim.",
              problems: ["LeetCode 76: Minimum Window Substring"],
              snippet: `from collections import Counter
def min_window(s, t):
    need = Counter(t)
    window = {}
    have, need_len = 0, len(need)
    res, res_len = [-1, -1], float('inf')
    l = 0
    for r, c in enumerate(s):
        if c in need:
            window[c] = window.get(c, 0) + 1
            if window[c] == need[c]: have += 1
        while have == need_len:
            if (r - l + 1) < res_len:
                res = [l, r]; res_len = r - l + 1
            left_c = s[l]
            if left_c in need:
                window[left_c] -= 1
                if window[left_c] < need[left_c]: have -= 1
            l += 1
    return s[res[0]:res[1]+1] if res_len != float('inf') else ""`
            },
            {
              id: "str-sw-anagram",
              name: "Anagram / permutation in string",
              isPattern: true,
              difficulty: "Medium",
              desc: "Slides a fixed window of size T on string S, validating if counts maps match the target string.",
              problems: ["LeetCode 438: Find All Anagrams", "LeetCode 567: Permutation in String"],
              snippet: `def check_inclusion(s1, s2):
    if len(s1) > len(s2): return False
    c1, c2 = [0]*26, [0]*26
    for i in range(len(s1)):
        c1[ord(s1[i]) - 97] += 1
        c2[ord(s2[i]) - 97] += 1
    matches = sum(1 for i in range(26) if c1[i] == c2[i])
    for i in range(len(s1), len(s2)):
        if matches == 26: return True
        # Slide window logic...
        pass
    return matches == 26`
            }
          ]
        },
        {
          name: "Two Pointers",
          children: [
            {
              id: "str-2p-pal",
              name: "Palindrome check",
              isPattern: true,
              difficulty: "Easy",
              desc: "Compares alphanumeric characters moving inwards from outer ends, skipping spacing and casing differences.",
              problems: ["LeetCode 125: Valid Palindrome", "LeetCode 680: Valid Palindrome II"],
              snippet: `def is_palindrome(s):
    l, r = 0, len(s) - 1
    while l < r:
        while l < r and not s[l].isalnum(): l += 1
        while l < r and not s[r].isalnum(): r -= 1
        if s[l].lower() != s[r].lower(): return False
        l, r = l + 1, r - 1
    return True`
            },
            {
              id: "str-2p-rev",
              name: "Reverse words / characters",
              isPattern: true,
              difficulty: "Easy",
              desc: "Applies two-pointer swaps outwards/inwards to reverse characters or isolated word strings in-place.",
              problems: ["LeetCode 151: Reverse Words in a String", "LeetCode 344: Reverse String"],
              snippet: `def reverse_string(s):
    l, r = 0, len(s) - 1
    while l < r:
        s[l], s[r] = s[r], s[l]
        l += 1; r -= 1`
            },
            {
              id: "str-2p-comp",
              name: "String compression",
              isPattern: true,
              difficulty: "Medium",
              desc: "Compresses repeating characters in-place using read and write pointers to record characters and counts.",
              problems: ["LeetCode 443: String Compression"],
              snippet: `def compress(chars):
    write = read = 0
    while read < len(chars):
        c = chars[read]
        cnt = 0
        while read < len(chars) and chars[read] == c:
            read += 1; cnt += 1
        chars[write] = c; write += 1
        if cnt > 1:
            for digit in str(cnt):
                chars[write] = digit; write += 1
    return write`
            }
          ]
        },
        {
          name: "Pattern Matching",
          children: [
            {
              id: "str-pm-kmp",
              name: "KMP (failure function)",
              isPattern: true,
              difficulty: "Hard",
              desc: "Speeds up substring matching in O(N+M) time by precomputing a Longest Prefix Suffix (LPS) helper to bypass redundancies.",
              problems: ["LeetCode 28: Index of First Occurrence"],
              snippet: `def compute_lps(pat):
    lps = [0] * len(pat)
    j = 0
    for i in range(1, len(pat)):
        while j > 0 and pat[i] != pat[j]: j = lps[j-1]
        if pat[i] == pat[j]: j += 1; lps[i] = j
    return lps`
            },
            {
              id: "str-pm-rk",
              name: "Rabin-Karp (rolling hash)",
              isPattern: true,
              difficulty: "Hard",
              desc: "Evaluates rolling hashes of sliding text windows to locate matching pattern values in average O(N+M) time.",
              problems: ["LeetCode 187: Repeated DNA Sequences"],
              snippet: `def rolling_hash(s, l):
    # compute hash in window length L
    pass`
            },
            {
              id: "str-pm-z",
              name: "Z-algorithm",
              isPattern: true,
              difficulty: "Hard",
              desc: "Constructs prefix matching Z-arrays linearly by mirroring bounds calculated over matches.",
              problems: ["LeetCode 2223: Sum of Scores of Built Strings"],
              snippet: `def get_z_array(s):
    z = [0] * len(s)
    l = r = 0
    for i in range(1, len(s)):
        if i <= r: z[i] = min(r - i + 1, z[i - l])
        while i + z[i] < len(s) and s[z[i]] == s[i + z[i]]: z[i] += 1
        if i + z[i] - 1 > r: l, r = i, i + z[i] - 1
    return z`
            }
          ]
        }
      ]
    },
    {
      id: "hashmap",
      name: "Hash map",
      color: "#3B82F6", // Blue
      children: [
        {
          id: "hash-freq",
          name: "Frequency Based",
          isPattern: true,
          difficulty: "Easy",
          desc: "Tabulates character or integer occurrences inside hash maps to handle top-k lists and uniqueness checks.",
          problems: ["LeetCode 387: First Unique Character", "LeetCode 347: Top K Frequent Elements"],
          snippet: `def frequency_map(nums):
    counts = {}
    for x in nums: counts[x] = counts.get(x, 0) + 1
    return counts`
        },
        {
          id: "hash-lookup",
          name: "Lookup Based",
          isPattern: true,
          difficulty: "Easy",
          desc: "Performs O(1) checks for matching complements or key existence to skip nested loops.",
          problems: ["LeetCode 1: Two Sum", "LeetCode 217: Contains Duplicate"],
          snippet: `def contains_duplicate(nums):
    seen = set()
    for x in nums:
        if x in seen: return True
        seen.add(x)
    return False`
        },
        {
          id: "hash-set",
          name: "Set Based",
          isPattern: true,
          difficulty: "Medium",
          desc: "Identifies custom continuous coordinate sweeps utilizing Hash Sets to achieve linear lookups.",
          problems: ["LeetCode 128: Longest Consecutive Sequence"],
          snippet: `def longest_consec(nums):
    num_set = set(nums)
    max_len = 0
    for x in nums:
        if x - 1 not in num_set:
            curr = x; curr_len = 1
            while curr + 1 in num_set:
                curr += 1; curr_len += 1
            max_len = max(max_len, curr_len)
    return max_len`
        },
        {
          id: "hash-index",
          name: "Index Mapping",
          isPattern: true,
          difficulty: "Medium",
          desc: "Maps key values directly to earliest or latest array index positions to calculate subarray bounds.",
          problems: ["LeetCode 525: Contiguous Array", "LeetCode 325: Maximum Size Subarray Sum Equals k"],
          snippet: `def max_sub_array_len(nums, k):
    lookup = {0: -1}
    curr_sum = max_len = 0
    for i, x in enumerate(nums):
        curr_sum += x
        if curr_sum - k in lookup:
            max_len = max(max_len, i - lookup[curr_sum - k])
        if curr_sum not in lookup:
            lookup[curr_sum] = i
    return max_len`
        },
        {
          id: "hash-grouping",
          name: "Grouping Pattern",
          isPattern: true,
          difficulty: "Medium",
          desc: "Groups array items inside a hash map using a standardized signature or sorted representation as key values.",
          problems: ["LeetCode 49: Group Anagrams"],
          snippet: `def group_anagrams(strs):
    ans = {}
    for s in strs:
        key = "".join(sorted(s))
        ans.setdefault(key, []).append(s)
    return list(ans.values())`
        }
      ]
    },
    {
      id: "stack",
      name: "Stack",
      color: "#14B8A6", // Teal
      children: [
        {
          name: "Monotonic Stack",
          children: [
            {
              id: "stk-mono-inc",
              name: "Increasing",
              isPattern: true,
              difficulty: "Medium",
              desc: "Stack keeps elements in strictly increasing values, useful for finding nearest smaller elements.",
              problems: ["LeetCode 84: Largest Rectangle in Histogram"],
              snippet: `def increasing_stack(arr):
    stack = []
    for i, x in enumerate(arr):
        while stack and stack[-1] > x:
            stack.pop()
        stack.append(x)`
            },
            {
              id: "stk-mono-dec",
              name: "Decreasing",
              isPattern: true,
              difficulty: "Medium",
              desc: "Stack keeps elements in strictly decreasing values, useful for finding nearest greater elements.",
              problems: ["LeetCode 739: Daily Temperatures"],
              snippet: `def daily_temp(T):
    ans = [0] * len(T)
    stack = []
    for i, x in enumerate(T):
        while stack and T[stack[-1]] < x:
            idx = stack.pop()
            ans[idx] = i - idx
        stack.append(i)
    return ans`
            }
          ]
        },
        {
          name: "Nearest Element",
          children: [
            {
              id: "stk-near-greater",
              name: "Next Greater",
              isPattern: true,
              difficulty: "Medium",
              desc: "Walks array to resolve the next element on the right possessing a larger value.",
              problems: ["LeetCode 496: Next Greater Element I", "LeetCode 503: Next Greater Element II"],
              snippet: `def next_greater(nums):
    res = [-1] * len(nums)
    stack = []
    for i in range(len(nums)):
        while stack and nums[stack[-1]] < nums[i]:
            res[stack.pop()] = nums[i]
        stack.append(i)
    return res`
            },
            {
              id: "stk-near-smaller",
              name: "Next Smaller",
              isPattern: true,
              difficulty: "Medium",
              desc: "Resolves the index of the first smaller element on the right using a monotonic increasing stack.",
              problems: ["LeetCode 84: Largest Rectangle (Next Smaller boundaries)"],
              snippet: `def next_smaller(arr):
    # monotonic increasing indices pop resolver
    pass`
            },
            {
              id: "stk-near-prev",
              name: "Previous Variants",
              isPattern: true,
              difficulty: "Medium",
              desc: "Iterates elements from left-to-right (or right-to-left) to resolve adjacent previous boundaries in a single sweep.",
              problems: ["LeetCode 901: Online Stock Span"],
              snippet: `class StockSpanner:
    def __init__(self):
        self.stack = [] # (price, span)
    def next(self, price):
        span = 1
        while self.stack and self.stack[-1][0] <= price:
            span += self.stack.pop()[1]
        self.stack.append((price, span))
        return span`
            }
          ]
        },
        {
          id: "stk-range",
          name: "Range / Span",
          isPattern: true,
          difficulty: "Medium",
          desc: "Identifies numeric subsegment spans where elements remain larger or smaller than reference values.",
          problems: ["LeetCode 901: Online Stock Span"],
          snippet: `def calculate_spans(prices):
    stack = [] # stack of indices
    spans = []
    for i, p in enumerate(prices):
        while stack and prices[stack[-1]] <= p: stack.pop()
        spans.append(i + 1 if not stack else i - stack[-1])
        stack.append(i)
    return spans`
        },
        {
          id: "stk-minmax",
          name: "min/Max Stack",
          isPattern: true,
          difficulty: "Medium",
          desc: "Supports retrieval of minimum/maximum elements in O(1) time by caching adjacent active minimums.",
          problems: ["LeetCode 155: Min Stack"],
          snippet: `class MinStack:
    def __init__(self):
        self.stack = []
        self.min_stack = []
    def push(self, x):
        self.stack.append(x)
        if not self.min_stack or x <= self.min_stack[-1]: self.min_stack.append(x)
    def pop(self):
        if self.stack.pop() == self.min_stack[-1]: self.min_stack.pop()
    def getMin(self): return self.min_stack[-1]`
        },
        {
          id: "stk-expr",
          name: "Expression Handling",
          isPattern: true,
          difficulty: "Hard",
          desc: "Parses mathematical brackets and operator sequences recursively or using stacks.",
          problems: ["LeetCode 224: Basic Calculator", "LeetCode 150: Evaluate Reverse Polish Notation"],
          snippet: `def eval_rpn(tokens):
    stack = []
    for t in tokens:
        if t not in "+-*/": stack.append(int(t))
        else:
            r, l = stack.pop(), stack.pop()
            if t == '+': stack.append(l + r)
            elif t == '-': stack.append(l - r)
            elif t == '*': stack.append(l * r)
            elif t == '/': stack.append(int(l / r))
    return stack[0]`
        },
        {
          id: "stk-histo",
          name: "Histogram Pattern",
          isPattern: true,
          difficulty: "Hard",
          desc: "Tracks monotonic index boundaries to determine max areas bounded by heights.",
          problems: ["LeetCode 84: Largest Rectangle in Histogram", "LeetCode 85: Maximal Rectangle"],
          snippet: `def largest_rectangle_area(heights):
    heights.append(0)
    stack = [-1]
    ans = 0
    for i, h in enumerate(heights):
        while stack and heights[stack[-1]] > h:
            height = heights[stack.pop()]
            width = i - stack[-1] - 1
            ans = max(ans, height * width)
        stack.append(i)
    return ans`
        }
      ]
    },
    {
      id: "queue",
      name: "QUEUE / DEQUE",
      color: "#F97316", // Orange
      children: [
        {
          id: "q-fifo",
          name: "FIFO Processing",
          isPattern: true,
          difficulty: "Easy",
          desc: "Processes data streams dynamically in first-in-first-out order, preserving chronological ordering.",
          problems: ["LeetCode 933: Number of Recent Calls"],
          snippet: `from collections import deque
class RecentCounter:
    def __init__(self):
        self.q = deque()
    def ping(self, t: int) -> int:
        self.q.append(t)
        while self.q[0] < t - 3000:
            self.q.popleft()
        return len(self.q)`
        },
        {
          id: "q-level",
          name: "Level-wise Processing",
          isPattern: true,
          difficulty: "Easy",
          desc: "Implements tree or graph Breadth-First Searches by expanding nodes level by level using a FIFO queue.",
          problems: ["LeetCode 102: Level Order Traversal", "LeetCode 199: Binary Tree Right Side View"],
          snippet: `def right_side_view(root):
    if not root: return []
    res = []
    q = deque([root])
    while q:
        level_len = len(q)
        for i in range(level_len):
            node = q.popleft()
            if i == level_len - 1: res.append(node.val)
            if node.left: q.append(node.left)
            if node.right: q.append(node.right)
    return res`
        },
        {
          id: "q-circular",
          name: "Circular Queue Pattern",
          isPattern: true,
          difficulty: "Medium",
          desc: "Maintains fixed-size buffers using dual pointers wrapping modulo capacity limits to process continuous streams.",
          problems: ["LeetCode 622: Design Circular Queue"],
          snippet: `class MyCircularQueue:
    def __init__(self, k: int):
        self.q = [0]*k
        self.head = self.tail = self.size = 0
        self.cap = k`
        },
        {
          id: "q-deque",
          name: "Deque Based",
          isPattern: true,
          difficulty: "Hard",
          desc: "Supports quick insertions and deletions on both outer boundaries, key to solving sliding window extremes.",
          problems: ["LeetCode 239: Sliding Window Maximum"],
          snippet: `from collections import deque
def clean_deque(dq, i, k, nums):
    if dq and dq[0] == i - k: dq.popleft()
    while dq and nums[dq[-1]] < nums[i]: dq.pop()`
        }
      ]
    },
    {
      id: "linkedlist",
      name: "LINKED LIST",
      color: "#F59E0B", // Yellow
      children: [
        {
          name: "Pointer Techniques",
          children: [
            {
              id: "ll-pt-slowfast",
              name: "Fast–Slow",
              isPattern: true,
              difficulty: "Easy",
              desc: "Employs two pointers moving at different speeds to locate lists nodes.",
              problems: ["LeetCode 876: Middle of List"],
              snippet: `def get_middle(head):
    slow = fast = head
    while fast and fast.next:
        slow = slow.next
        fast = fast.next.next
    return slow`
            },
            {
              id: "ll-pt-cycle",
              name: "Cycle Detection",
              isPattern: true,
              difficulty: "Easy",
              desc: "Detects linked list loops in constant space by checking if fast and slow pointers overlap.",
              problems: ["LeetCode 141: Linked List Cycle", "LeetCode 142: Linked List Cycle II"],
              snippet: `def has_cycle(head):
    slow = fast = head
    while fast and fast.next:
        slow = slow.next
        fast = fast.next.next
        if slow == fast: return True
    return False`
            },
            {
              id: "ll-pt-middle",
              name: "Finding Middle",
              isPattern: true,
              difficulty: "Easy",
              desc: "Divides list subsegments dynamically utilizing midpoint indicators as splits in sorting routines.",
              problems: ["LeetCode 148: Sort List (Merge Sort midpoints)"],
              snippet: `def split_list(head):
    # returns middle node for merge splits
    pass`
            }
          ]
        },
        {
          name: "Reversal",
          children: [
            {
              id: "ll-rev-full",
              name: "Full Reverse",
              isPattern: true,
              difficulty: "Easy",
              desc: "Reverses a list in O(N) time and O(1) space by pointing nodes backwards.",
              problems: ["LeetCode 206: Reverse Linked List"],
              snippet: `def reverse_list(head):
    prev = None
    curr = head
    while curr:
        nxt = curr.next
        curr.next = prev
        prev = curr
        curr = nxt
    return prev`
            },
            {
              id: "ll-rev-partial",
              name: "Partial (k-group)",
              isPattern: true,
              difficulty: "Hard",
              desc: "Reverses list segments of length K iteratively, preserving connections across segments.",
              problems: ["LeetCode 25: Reverse Nodes in k-Group", "LeetCode 92: Reverse Linked List II"],
              snippet: `def reverse_k_group(head, k):
    curr = head
    count = 0
    while curr and count < k:
        curr = curr.next; count += 1
    if count == k:
        prev = reverse_k_group(curr, k)
        curr = head
        for _ in range(k):
            nxt = curr.next
            curr.next = prev
            prev = curr
            curr = nxt
        return prev
    return head`
            }
          ]
        },
        {
          id: "ll-merge",
          name: "Merge Lists",
          isPattern: true,
          difficulty: "Easy",
          desc: "Combines sorted linked lists by comparing head pointer nodes and stitching recursively.",
          problems: ["LeetCode 21: Merge Two Sorted Lists", "LeetCode 23: Merge K Sorted Lists"],
          snippet: `def merge_two(l1, l2):
    dummy = ListNode()
    curr = dummy
    while l1 and l2:
        if l1.val < l2.val:
            curr.next = l1; l1 = l1.next
        else:
            curr.next = l2; l2 = l2.next
        curr = curr.next
    curr.next = l1 or l2
    return dummy.next`
        }
      ]
    },
    {
      id: "trees",
      name: "TREES",
      color: "#EF4444", // Red
      children: [
        {
          name: "Traversal",
          children: [
            {
              id: "tr-trav-dfs",
              name: "DFS (Pre / In / Post order)",
              isPattern: true,
              difficulty: "Easy",
              desc: "Recursive and iterative searches covering root and child branches systematically.",
              problems: ["LeetCode 94: Inorder", "LeetCode 144: Preorder", "LeetCode 145: Postorder"],
              snippet: `def dfs_inorder(node):
    if not node: return
    dfs_inorder(node.left)
    print(node.val)
    dfs_inorder(node.right)`
            },
            {
              id: "tr-trav-bfs",
              name: "BFS (Level Order/ zigzag/ right side view)",
              isPattern: true,
              difficulty: "Easy",
              desc: "Explores nodes level-by-level horizontally using FIFO queues.",
              problems: ["LeetCode 102: Level Order", "LeetCode 103: Zigzag Traversal"],
              snippet: `def level_order(root):
    if not root: return []
    q, res = deque([root]), []
    while q:
        level = []
        for _ in range(len(q)):
            node = q.popleft()
            level.append(node.val)
            if node.left: q.append(node.left)
            if node.right: q.append(node.right)
        res.append(level)
    return res`
            }
          ]
        },
        {
          name: "Recursion Patterns",
          children: [
            {
              id: "tr-rec-topdown",
              name: "Top Down approach",
              isPattern: true,
              difficulty: "Medium",
              desc: "Passes parameters down to child nodes recursively to calculate properties from top bounds.",
              problems: ["LeetCode 112: Path Sum", "LeetCode 129: Sum Root to Leaf Numbers"],
              snippet: `def sum_numbers(root, curr=0):
    if not root: return 0
    curr = curr * 10 + root.val
    if not root.left and not root.right: return curr
    return sum_numbers(root.left, curr) + sum_numbers(root.right, curr)`
            },
            {
              id: "tr-rec-bottomup",
              name: "Bottom Up approach",
              isPattern: true,
              difficulty: "Medium",
              desc: "Retrieves answers from child nodes bottom-up, synthesizing combined properties at the parent level.",
              problems: ["LeetCode 110: Balanced Binary Tree", "LeetCode 236: Lowest Common Ancestor"],
              snippet: `def lca(root, p, q):
    if not root or root == p or root == q: return root
    left = lca(root.left, p, q)
    right = lca(root.right, p, q)
    if left and right: return root
    return left or right`
            }
          ]
        },
        {
          name: "Path Based",
          children: [
            {
              id: "tr-path-maxsum",
              name: "Max path sum",
              isPattern: true,
              difficulty: "Hard",
              desc: "Finds max root-to-root or leaf-to-leaf paths bottom-up, keeping track of global maximums.",
              problems: ["LeetCode 124: Binary Tree Maximum Path Sum"],
              snippet: `def max_path_sum(root):
    self.ans = float('-inf')
    def get_max(node):
        if not node: return 0
        left = max(0, get_max(node.left))
        right = max(0, get_max(node.right))
        self.ans = max(self.ans, node.val + left + right)
        return node.val + max(left, right)
    get_max(root)
    return self.ans`
            },
            {
              id: "tr-path-diam",
              name: "Diameter/Height / depth",
              isPattern: true,
              difficulty: "Medium",
              desc: "Calculates dimensions recursively at each node to track long paths bounded by root connections.",
              problems: ["LeetCode 543: Diameter of Tree", "LeetCode 104: Maximum Depth"],
              snippet: `def diameter(root):
    self.d = 0
    def height(node):
        if not node: return 0
        l, r = height(node.left), height(node.right)
        self.d = max(self.d, l + r)
        return 1 + max(l, r)
    height(root)
    return self.d`
            }
          ]
        },
        {
          id: "tr-bst",
          name: "BST (Binary Search Tree)",
          isPattern: true,
          difficulty: "Medium",
          desc: "Exploits Binary Search Tree property (left children < root < right children) to perform search operations.",
          problems: ["LeetCode 98: Validate BST", "LeetCode 235: LCA of a BST"],
          snippet: `def validate_bst(root, min_val=float('-inf'), max_val=float('inf')):
    if not root: return True
    if not (min_val < root.val < max_val): return False
    return (validate_bst(root.left, min_val, root.val) and 
            validate_bst(root.right, root.val, max_val))`
        }
      ]
    },
    {
      id: "recursion",
      name: "Recursion",
      color: "#7C3AED", // Violet
      children: [
        {
          name: "BACKTRACKING",
          children: [
            {
              name: "Exploration",
              children: [
                {
                  id: "rec-bt-decision",
                  name: "Decision Tree",
                  isPattern: true,
                  difficulty: "Medium",
                  desc: "Branches recursively over possible choices, drawing decision paths down recursively.",
                  problems: ["LeetCode 17: Letter Combinations of a Phone Number"],
                  snippet: `def letter_combinations(digits):
    if not digits: return []
    mapping = {"2": "abc", "3": "def"} # etc.
    res = []
    def backtrack(idx, path):
        if idx == len(digits):
            res.append("".join(path)); return
        for char in mapping[digits[idx]]:
            path.append(char)
            backtrack(idx + 1, path)
            path.pop()
    backtrack(0, [])
    return res`
                },
                {
                  id: "rec-bt-choose",
                  name: "Choose–Explore–Unchoose",
                  isPattern: true,
                  difficulty: "Medium",
                  desc: "Backtracking framework: select candidate, trigger recursion, then revert selection state.",
                  problems: ["LeetCode 39: Combination Sum"],
                  snippet: `def backtrack(start, target, path):
    if target == 0:
        res.append(path[:]); return
    for i in range(start, len(candidates)):
        if candidates[i] > target: continue
        path.append(candidates[i])
        backtrack(i, target - candidates[i], path) # choose + explore
        path.pop() # unchoose`
                },
                {
                  id: "rec-bt-subsets",
                  name: "Subsets (power set)",
                  isPattern: true,
                  difficulty: "Medium",
                  desc: "Generates power subsets recursively by choosing to either include or exclude the current element.",
                  problems: ["LeetCode 78: Subsets", "LeetCode 90: Subsets II"],
                  snippet: `def subsets(nums):
    res = []
    def solve(idx, curr):
        if idx == len(nums):
            res.append(curr[:]); return
        curr.append(nums[idx])
        solve(idx + 1, curr)
        curr.pop()
        solve(idx + 1, curr)
    solve(0, [])
    return res`
                },
                {
                  id: "rec-bt-perm",
                  name: "PermutationsCombinations (nCr)",
                  isPattern: true,
                  difficulty: "Medium",
                  desc: "Produces element permutations recursively, tracking used indicators to prevent index overlaps.",
                  problems: ["LeetCode 46: Permutations", "LeetCode 77: Combinations"],
                  snippet: `def permute(nums):
    res = []
    def backtrack(start):
        if start == len(nums):
            res.append(nums[:]); return
        for i in range(start, len(nums)):
            nums[start], nums[i] = nums[i], nums[start]
            backtrack(start + 1)
            nums[start], nums[i] = nums[i], nums[start]
    backtrack(0)
    return res`
                },
                {
                  id: "rec-bt-grid",
                  name: "Word search on grid",
                  isPattern: true,
                  difficulty: "Medium",
                  desc: "Runs 4-directional DFS searches on matrix grids, flagging active nodes and clearing marks upon backtrack splits.",
                  problems: ["LeetCode 79: Word Search"],
                  snippet: `def dfs(r, c, idx):
    if idx == len(word): return True
    if not (0<=r<R and 0<=c<C) or board[r][c] != word[idx]: return False
    tmp, board[r][c] = board[r][c], "#"
    ans = (dfs(r+1,c,idx+1) or dfs(r-1,c,idx+1) or dfs(r,c+1,idx+1) or dfs(r,c-1,idx+1))
    board[r][c] = tmp
    return ans`
                },
                {
                  id: "rec-bt-pal",
                  name: "Palindrome partitioning",
                  isPattern: true,
                  difficulty: "Hard",
                  desc: "Splits strings recursively, validating if segments form valid palindromes before partitioning deep subproblems.",
                  problems: ["LeetCode 131: Palindrome Partitioning"],
                  snippet: `def partition(s):
    res = []
    def backtrack(start, path):
        if start == len(s):
            res.append(path[:]); return
        for end in range(start + 1, len(s) + 1):
            sub = s[start:end]
            if sub == sub[::-1]:
                path.append(sub)
                backtrack(end, path)
                path.pop()
    backtrack(0, [])
    return res`
                }
              ]
            },
            {
              id: "rec-bt-prune",
              name: "Pruning / State Tracking",
              isPattern: true,
              difficulty: "Hard",
              desc: "Prunes recursion branches early using mathematical checks or pre-sorted states.",
              problems: ["LeetCode 51: N-Queens", "LeetCode 37: Sudoku Solver"],
              snippet: `def is_safe(r, c, board):
    # validates row, column, and diagonal constraints to prune search early
    return True`
            }
          ]
        },
        {
          name: "Divide & Conquer",
          children: [
            {
              id: "rec-dc-merge",
              name: "Merge sort pattern",
              isPattern: true,
              difficulty: "Medium",
              desc: "Splits lists recursively, sorting fragments and stiching them back together.",
              problems: ["LeetCode 912: Sort an Array (Merge Sort)"],
              snippet: `def merge_sort(arr):
    if len(arr) <= 1: return arr
    mid = len(arr) // 2
    l = merge_sort(arr[:mid])
    r = merge_sort(arr[mid:])
    return merge(l, r)`
            },
            {
              id: "rec-dc-select",
              name: "Quick select (Kth largest)",
              isPattern: true,
              difficulty: "Medium",
              desc: "Quickselect splits array bounds around pivots to locate elements in O(N) average time.",
              problems: ["LeetCode 215: Kth Largest Element in an Array"],
              snippet: `def quickselect(arr, k, l, r):
    # partitions around pivot indices to narrow search bounds
    pass`
            },
            {
              id: "rec-dc-inv",
              name: "Count inversions",
              isPattern: true,
              difficulty: "Hard",
              desc: "Counts elements occurring out of order by tracking overlapping bounds inside merge sort checks.",
              problems: ["GeeksforGeeks: Count Inversions"],
              snippet: `def merge_count(arr, l, r):
    # sums splits during sorted merges
    pass`
            }
          ]
        }
      ]
    },
    {
      id: "heap",
      name: "Heap",
      color: "#059669", // Green
      children: [
        {
          id: "hp-k",
          name: "Top K/ Kth Element/ k closest points",
          isPattern: true,
          difficulty: "Medium",
          desc: "Retains K target elements by maintaining a size K priority min-heap.",
          problems: ["LeetCode 347: Top K Frequent", "LeetCode 973: K Closest Points"],
          snippet: `import heapq
def top_k_frequent(nums, k):
    counts = Counter(nums)
    heap = []
    for num, count in counts.items():
        heapq.heappush(heap, (count, num))
        if len(heap) > k: heapq.heappop(heap)
    return [x[1] for x in heap]`
        },
        {
          name: "Greedy+ Heap",
          children: [
            {
              id: "hp-gr-tasks",
              name: "Task scheduler",
              isPattern: true,
              difficulty: "Medium",
              desc: "Schedules highly frequent elements using priority max-heaps combined with cooling queues.",
              problems: ["LeetCode 621: Task Scheduler"],
              snippet: `import heapq
from collections import Counter, deque
def task_scheduler(tasks, n):
    counts = Counter(tasks)
    heap = [-c for c in counts.values()]
    heapq.heapify(heap)
    q = deque()
    time = 0
    while heap or q:
        time += 1
        if heap:
            cnt = heapq.heappop(heap) + 1
            if cnt != 0: q.append((cnt, time + n))
        if q and q[0][1] == time:
            heapq.heappush(heap, q.popleft()[0])
    return time`
            },
            {
              id: "hp-gr-meetings",
              name: "Meeting rooms",
              isPattern: true,
              difficulty: "Medium",
              desc: "Maintains meeting end times inside min-heaps to determine minimum overlap platforms.",
              problems: ["LeetCode 253: Meeting Rooms II"],
              snippet: `import heapq
def min_meeting_rooms(intervals):
    if not intervals: return 0
    intervals.sort(key=lambda x: x[0])
    heap = [intervals[0][1]]
    for start, end in intervals[1:]:
        if heap[0] <= start: heapq.heappop(heap)
        heapq.heappush(heap, end)
    return len(heap)`
            },
            {
              id: "hp-gr-reorg",
              name: "Reorganize string",
              isPattern: true,
              difficulty: "Medium",
              desc: "Reorganizes character strings using priority heaps to always place the most frequent remaining characters.",
              problems: ["LeetCode 767: Reorganize String"],
              snippet: `import heapq
def reorganize_string(s):
    counts = Counter(s)
    heap = [(-cnt, char) for char, cnt in counts.items()]
    heapq.heapify(heap)
    prev_cnt, prev_char = 0, ""
    res = []
    while heap:
        cnt, char = heapq.heappop(heap)
        res.append(char)
        if prev_cnt < 0: heapq.heappush(heap, (prev_cnt, prev_char))
        prev_cnt, prev_char = cnt + 1, char
    return "".join(res) if len(res) == len(s) else ""`
            },
            {
              id: "hp-gr-huffman",
              name: "Huffman encoding",
              isPattern: true,
              difficulty: "Medium",
              desc: "Stitches nodes recursively by picking the two lowest weight nodes in priority heaps to build encoding trees.",
              problems: ["GeeksforGeeks: Huffman Coding"],
              snippet: `def build_huffman(freqs):
    # heaps lowest nodes iteratively to construct trees
    pass`
            }
          ]
        },
        {
          id: "hp-kway",
          name: "K-way Merge",
          isPattern: true,
          difficulty: "Hard",
          desc: "Merges sorted streams by maintaining a min-heap populated with the current heads of each stream.",
          problems: ["LeetCode 23: Merge K Sorted Lists", "LeetCode 378: Kth Smallest in Sorted Matrix"],
          snippet: `import heapq
def merge_k_lists(lists):
    heap = []
    for i, lst in enumerate(lists):
        if lst: heapq.heappush(heap, (lst.val, i, lst))
    dummy = ListNode()
    curr = dummy
    while heap:
        val, idx, node = heapq.heappop(heap)
        curr.next = ListNode(val)
        curr = curr.next
        if node.next:
            heapq.heappush(heap, (node.next.val, idx, node.next))
    return dummy.next`
        }
      ]
    },
    {
      id: "graphs",
      name: "Graphs",
      color: "#854D0E", // Olive
      children: [
        {
          name: "Traversal",
          children: [
            {
              id: "gr-trav-bfs",
              name: "BFS",
              isPattern: true,
              difficulty: "Easy",
              desc: "Explores vertices level-by-level using a FIFO queue, finding shortest paths on unweighted graphs.",
              problems: ["LeetCode 200: Number of Islands (BFS)"],
              snippet: `from collections import deque
def bfs_graph(start, adj):
    visited = {start}
    q = deque([start])
    while q:
        u = q.popleft()
        for v in adj[u]:
            if v not in visited:
                visited.add(v); q.append(v)`
            },
            {
              id: "gr-trav-dfs",
              name: "DFS",
              isPattern: true,
              difficulty: "Easy",
              desc: "Explores vertices recursively along paths before backtracking, key for connectivity checks.",
              problems: ["LeetCode 200: Number of Islands (DFS)"],
              snippet: `def dfs_graph(u, adj, visited):
    visited.add(u)
    for v in adj[u]:
        if v not in visited:
            dfs_graph(v, adj, visited)`
            }
          ]
        },
        {
          name: "Cycle Detection",
          children: [
            {
              id: "gr-cyc-dir",
              name: "Directed",
              isPattern: true,
              difficulty: "Medium",
              desc: "Checks cycles using recursion stack sets or coloring (unvisited/visiting/visited) in DFS traversals.",
              problems: ["LeetCode 207: Course Schedule (DFS Cycle Check)"],
              snippet: `def has_cycle_directed(crs, adj, state):
    if state[crs] == 1: return True # visiting
    if state[crs] == 2: return False # visited
    state[crs] = 1
    for pre in adj[crs]:
        if has_cycle_directed(pre, adj, state): return True
    state[crs] = 2
    return False`
            },
            {
              id: "gr-cyc-undir",
              name: "Undirected",
              isPattern: true,
              difficulty: "Medium",
              desc: "Checks cycle by verifying if visited nodes are reached from paths other than direct parent routes.",
              problems: ["LeetCode 684: Redundant Connection"],
              snippet: `def has_cycle_undirected(u, parent, adj, visited):
    visited.add(u)
    for v in adj[u]:
        if v == parent: continue
        if v in visited: return True
        if has_cycle_undirected(v, u, adj, visited): return True
    return False`
            }
          ]
        },
        {
          name: "Topological Sort",
          children: [
            {
              id: "gr-topo-sort",
              name: "Topological Sort (BFS / DFS)",
              isPattern: true,
              difficulty: "Medium",
              desc: "Linear ordering of Directed Acyclic Graph vertices such that for edge U-V, node U occurs before V.",
              problems: ["LeetCode 210: Course Schedule II"],
              snippet: `def topo_sort(n, adj):
    visited = [0]*n; res = []
    def dfs(u):
        visited[u] = 1
        for v in adj[u]:
            if visited[v] == 1: return False
            if visited[v] == 0 and not dfs(v): return False
        visited[u] = 2; res.append(u); return True
    for i in range(n):
        if visited[i] == 0 and not dfs(i): return []
    return res[::-1]`
            },
            {
              id: "gr-topo-kahn",
              name: "Kahn's algorithm (BFS in-degree)",
              isPattern: true,
              difficulty: "Medium",
              desc: "Uses in-degree counts and queues to extract topological ordering from directed graphs.",
              problems: ["LeetCode 207: Course Schedule (Kahn version)"],
              snippet: `def kahns(n, adj):
    indegree = [0]*n
    for u in range(n):
        for v in adj[u]: indegree[v] += 1
    q = deque([i for i in range(n) if indegree[i] == 0])
    order = []
    while q:
        u = q.popleft()
        order.append(u)
        for v in adj[u]:
            indegree[v] -= 1
            if indegree[v] == 0: q.append(v)
    return order if len(order) == n else []`
            },
            {
              id: "gr-topo-dfs",
              name: "DFS-based topo sort",
              isPattern: true,
              difficulty: "Medium",
              desc: "Traverses graph recursively via DFS, pushing finished nodes to a stack/list to reverse.",
              problems: ["LeetCode 210: Course Schedule II (DFS)"],
              snippet: `def dfs_topo(u, adj, visited, stack):
    visited.add(u)
    for v in adj[u]:
        if v not in visited: dfs_topo(v, adj, visited, stack)
    stack.append(u)`
            }
          ]
        },
        {
          name: "Shortest Path",
          children: [
            {
              id: "gr-sp-dijkstra",
              name: "Dijkstra",
              isPattern: true,
              difficulty: "Medium",
              desc: "Finds shortest paths from a source node using a Priority Queue on positive weighted graphs.",
              problems: ["LeetCode 743: Network Delay Time"],
              snippet: `import heapq
def dijkstra(start, n, adj):
    dist = {i: float('inf') for i in range(1, n+1)}
    dist[start] = 0
    pq = [(0, start)]
    while pq:
        d, u = heapq.heappop(pq)
        if d > dist[u]: continue
        for v, w in adj[u]:
            if dist[u] + w < dist[v]:
                dist[v] = dist[u] + w
                heapq.heappush(pq, (dist[v], v))
    return dist`
            },
            {
              id: "gr-sp-bf",
              name: "Bellman-Ford",
              isPattern: true,
              difficulty: "Medium",
              desc: "Finds shortest paths relaxation in O(V*E) supporting negative weights and detecting cycle failures.",
              problems: ["LeetCode 787: Cheapest Flights Within K Stops"],
              snippet: `def bellman_ford(start, n, edges):
    dist = [float('inf')] * n
    dist[start] = 0
    for _ in range(n - 1):
        for u, v, w in edges:
            if dist[u] != float('inf') and dist[u] + w < dist[v]:
                dist[v] = dist[u] + w
    return dist`
            },
            {
              id: "gr-sp-fw",
              name: "Floyd-Warshall (all pairs)",
              isPattern: true,
              difficulty: "Hard",
              desc: "Calculates all-pairs shortest paths using 3-nested DP matrix loops relaxed over intermediates.",
              problems: ["LeetCode 1334: Cities with Smallest Neighbors"],
              snippet: `def floyd_warshall(n, edges):
    dist = [[float('inf')]*n for _ in range(n)]
    for i in range(n): dist[i][i] = 0
    for u, v, w in edges: dist[u][v] = w
    for k in range(n):
        for i in range(n):
            for j in range(n):
                dist[i][j] = min(dist[i][j], dist[i][k] + dist[k][j])
    return dist`
            }
          ]
        },
        {
          name: "Spanning Tree",
          children: [
            {
              id: "gr-mst-kruskal",
              name: "Kruskal",
              isPattern: true,
              difficulty: "Medium",
              desc: "Finds Minimum Spanning Tree by sorting edges and connecting them recursively using Union-Find.",
              problems: ["LeetCode 1584: Min Cost to Connect All Points (Kruskal)"],
              snippet: `def kruskal(n, edges):
    parent = list(range(n))
    def find(i):
        if parent[i] == i: return i
        parent[i] = find(parent[i])
        return parent[i]
    edges.sort(key=lambda x: x[2])
    cost = 0
    for u, v, w in edges:
        root_u, root_v = find(u), find(v)
        if root_u != root_v:
            parent[root_u] = root_v; cost += w
    return cost`
            },
            {
              id: "gr-mst-prim",
              name: "Prims",
              isPattern: true,
              difficulty: "Medium",
              desc: "Grows Spanning Tree greedily by popping min weighted cut edges off heaps.",
              problems: ["LeetCode 1584: Min Cost to Connect Points (Prim version)"],
              snippet: `import heapq
def prims(n, adj):
    visited = set()
    pq = [(0, 0)] # (weight, node)
    cost = 0
    while len(visited) < n:
        w, u = heapq.heappop(pq)
        if u in visited: continue
        visited.add(u); cost += w
        for v, weight in adj[u]:
            if v not in visited: heapq.heappush(pq, (weight, v))
    return cost`
            }
          ]
        },
        {
          id: "gr-dsu",
          name: "Union-Find (DSU) Detect cycle in undirected",
          isPattern: true,
          difficulty: "Medium",
          desc: "Identifies connectivity cycles in undirected graphs efficiently using representative parenting arrays.",
          problems: ["LeetCode 684: Redundant Connection"],
          snippet: `class DSU:
    def __init__(self, size):
        self.parent = list(range(size))
    def find(self, i):
        if self.parent[i] == i: return i
        self.parent[i] = self.find(self.parent[i])
        return self.parent[i]
    def union(self, i, j):
        root_i, root_j = self.find(i), self.find(j)
        if root_i == root_j: return False
        self.parent[root_i] = root_j; return True`
        },
        {
          id: "gr-bip",
          name: "Bipartite/ Multi-source BFS/ 0-1 BFS",
          isPattern: true,
          difficulty: "Hard",
          desc: "Groups graphs vertices into bipartite colors or resolves dual-edge grids using specialized double ended queues.",
          problems: ["LeetCode 785: Is Graph Bipartite?", "LeetCode 542: 01 Matrix (Multi-source BFS)"],
          snippet: `def is_bipartite(graph):
    color = {}
    for node in range(len(graph)):
        if node not in color:
            q = deque([node])
            color[node] = 0
            while q:
                u = q.popleft()
                for v in graph[u]:
                    if v in color:
                        if color[v] == color[u]: return False
                    else:
                        color[v] = 1 - color[u]; q.append(v)
    return True`
        }
      ]
    },
    {
      id: "trie",
      name: "TRIE",
      color: "#9A3412", // Reddish-brown
      children: [
        {
          name: "Prefix Based",
          children: [
            {
              id: "tr-pre-ins",
              name: "Insert/Search",
              isPattern: true,
              difficulty: "Medium",
              desc: "Inserts and searches keys character-by-character in prefix tree nodes.",
              problems: ["LeetCode 208: Implement Trie"],
              snippet: `class TrieNode:
    def __init__(self):
        self.children = {}
        self.is_word = False

class Trie:
    def __init__(self):
        self.root = TrieNode()
    def insert(self, word):
        node = self.root
        for c in word:
            node = node.children.setdefault(c, TrieNode())
        node.is_word = True`
            },
            {
              id: "tr-pre-match",
              name: "Prefix Match",
              isPattern: true,
              difficulty: "Medium",
              desc: "Checks prefix boundaries to support autocomplete recommendations or suggest searches.",
              problems: ["LeetCode 208: StartsWith Method", "LeetCode 1268: Search Suggestions System"],
              snippet: `def starts_with(self, prefix):
    node = self.root
    for c in prefix:
        if c not in node.children: return False
        node = node.children[c]
    return True`
            }
          ]
        },
        {
          id: "tr-bitwise",
          name: "Bitwise Trie",
          isPattern: true,
          difficulty: "Hard",
          desc: "Aligns numbers as bit paths to evaluate maximum XOR splits in O(32) time.",
          problems: ["LeetCode 421: Maximum XOR of Two Numbers"],
          snippet: `class BitTrieNode:
    def __init__(self):
        self.children = [None, None]`
        }
      ]
    },
    {
      id: "dp",
      name: "DYNAMIC PROGRAMMING",
      color: "#64748B", // Slate
      children: [
        {
          name: "Core",
          children: [
            {
              id: "dp-core-1d",
              name: "1D",
              isPattern: true,
              difficulty: "Easy",
              desc: "Tracks optimal computations iteratively in a flat 1D state array.",
              problems: ["LeetCode 70: Climbing Stairs", "LeetCode 198: House Robber"],
              snippet: `def climb_stairs(n):
    if n <= 2: return n
    dp = [0]*(n+1)
    dp[1], dp[2] = 1, 2
    for i in range(3, n+1): dp[i] = dp[i-1] + dp[i-2]
    return dp[n]`
            },
            {
              id: "dp-core-2d",
              name: "2D",
              isPattern: true,
              difficulty: "Medium",
              desc: "Evaluates multi-variable decisions in 2D array states.",
              problems: ["LeetCode 62: Unique Paths", "LeetCode 1143: Longest Common Subsequence"],
              snippet: `def unique_paths(m, n):
    dp = [[1]*n for _ in range(m)]
    for r in range(1, m):
        for c in range(1, n):
            dp[r][c] = dp[r-1][c] + dp[r][c-1]
    return dp[m-1][n-1]`
            }
          ]
        },
        {
          name: "Transition Type",
          children: [
            {
              id: "dp-trans-linear",
              name: "Linear DP",
              isPattern: true,
              difficulty: "Medium",
              desc: "State transition relies on linear indices (e.g. DP[i] = DP[i-1] + DP[i-2]).",
              problems: ["LeetCode 198: House Robber", "LeetCode 91: Decode Ways"],
              snippet: `def rob(nums):
    if not nums: return 0
    dp = [0]*(len(nums)+1)
    dp[1] = nums[0]
    for i in range(2, len(nums)+1):
        dp[i] = max(dp[i-1], dp[i-2] + nums[i-1])
    return dp[-1]`
            },
            {
              id: "dp-trans-grid",
              name: "Grid DP",
              isPattern: true,
              difficulty: "Medium",
              desc: "Transitions propagate along matrix directions (e.g. DP[r][c] = grid[r][c] + min(DP[r-1][c], DP[r][c-1])).",
              problems: ["LeetCode 64: Minimum Path Sum", "LeetCode 120: Triangle"],
              snippet: `def min_path_sum(grid):
    R, C = len(grid), len(grid[0])
    for r in range(R):
        for c in range(C):
            if r == 0 and c == 0: continue
            elif r == 0: grid[r][c] += grid[r][c-1]
            elif c == 0: grid[r][c] += grid[r-1][c]
            else: grid[r][c] += min(grid[r-1][c], grid[r][c-1])
    return grid[-1][-1]`
            },
            {
              id: "dp-trans-decision",
              name: "Decision DP",
              isPattern: true,
              difficulty: "Medium",
              desc: "Selects optimal transitions from a set of choices at each index (e.g. holding or selling stocks).",
              problems: ["LeetCode 309: Best Time to Buy and Sell Stock with Cooldown"],
              snippet: `def max_profit(prices):
    if not prices: return 0
    hold, sold, rest = -prices[0], 0, 0
    for p in prices[1:]:
        prev_sold = sold
        sold = hold + p
        hold = max(hold, rest - p)
        rest = max(rest, prev_sold)
    return max(sold, rest)`
            }
          ]
        },
        {
          name: "Pattern Types",
          children: [
            {
              id: "dp-pat-knapsack",
              name: "Knapsack",
              isPattern: true,
              difficulty: "Medium",
              desc: "Decides item subsets to include/exclude to maximize value within capacity weights.",
              problems: ["LeetCode 416: Partition Equal Subset Sum", "LeetCode 322: Coin Change"],
              snippet: `def coin_change(coins, amount):
    dp = [amount + 1] * (amount + 1)
    dp[0] = 0
    for i in range(1, amount + 1):
        for c in coins:
            if i >= c: dp[i] = min(dp[i], dp[i-c] + 1)
    return dp[amount] if dp[amount] <= amount else -1`
            },
            {
              id: "dp-pat-seq",
              name: "Sequence DP",
              isPattern: true,
              difficulty: "Medium",
              desc: "Evaluates matching subsequences or alignments between string intervals.",
              problems: ["LeetCode 1143: LCS", "LeetCode 300: LIS"],
              snippet: `def lcs(s1, s2):
    m, n = len(s1), len(s2)
    dp = [[0]*(n+1) for _ in range(m+1)]
    for i in range(1, m+1):
        for j in range(1, n+1):
            if s1[i-1] == s2[j-1]: dp[i][j] = dp[i-1][j-1] + 1
            else: dp[i][j] = max(dp[i-1][j], dp[i][j-1])
    return dp[m][n]`
            },
            {
              id: "dp-pat-part",
              name: "Partition DP",
              isPattern: true,
              difficulty: "Hard",
              desc: "Splits elements dynamically into separate partition groups to locate optimal configurations.",
              problems: ["LeetCode 1043: Partition Array for Maximum Sum"],
              snippet: `def max_sum_partition(arr, k):
    n = len(arr)
    dp = [0]*(n+1)
    for i in range(1, n+1):
        curr_max = 0
        for j in range(1, min(i, k)+1):
            curr_max = max(curr_max, arr[i-j])
            dp[i] = max(dp[i], dp[i-j] + curr_max * j)
    return dp[n]`
            },
            {
              id: "dp-pat-interval",
              name: "Interval DP",
              isPattern: true,
              difficulty: "Hard",
              desc: "Computes subproblem intervals recursively, branching over internal pivot boundaries.",
              problems: ["LeetCode 312: Burst Balloons"],
              snippet: `def burst_balloons(nums):
    # burst window intervals L iteratively from pivot bounds
    pass`
            }
          ]
        },
        {
          name: "Advanced",
          children: [
            {
              id: "dp-adv-bitmask",
              name: "Bitmask DP",
              isPattern: true,
              difficulty: "Hard",
              desc: "Leverages numeric integer bit representations to represent item selection combinations.",
              problems: ["LeetCode 526: Beautiful Arrangement"],
              snippet: `def solve_mask(idx, mask, n, memo={}):
    if idx > n: return 1
    if (idx, mask) in memo: return memo[(idx, mask)]
    ans = 0
    for val in range(1, n+1):
        if not (mask & (1 << val)):
            if val % idx == 0 or idx % val == 0:
                ans += solve_mask(idx+1, mask | (1<<val), n, memo)
    memo[(idx, mask)] = ans; return ans`
            },
            {
              id: "dp-adv-digit",
              name: "Digit DP",
              isPattern: true,
              difficulty: "Hard",
              desc: "Counts decimal digit strings recursively matching constraints bounded by numeric values.",
              problems: ["LeetCode 233: Number of Digit One"],
              snippet: `def solve_digit(idx, count, is_limit):
    # recursion sweeps over digit limitations
    pass`
            },
            {
              id: "dp-adv-tree",
              name: "DP on Trees",
              isPattern: true,
              difficulty: "Hard",
              desc: "Solves recursive node decisions bottom-up, keeping track of choice states (include/exclude) in tree nodes.",
              problems: ["LeetCode 337: House Robber III"],
              snippet: `def rob_tree(root):
    def dfs(node):
        if not node: return (0, 0) # (rob, skip)
        l, r = dfs(node.left), dfs(node.right)
        rob_val = node.val + l[1] + r[1]
        skip_val = max(l) + max(r)
        return (rob_val, skip_val)
    return max(dfs(root))`
            }
          ]
        },
        {
          name: "Optimization",
          children: [
            {
              id: "dp-opt-memo",
              name: "Memoization",
              isPattern: true,
              difficulty: "Easy",
              desc: "Saves recursive outputs inside dictionary caches to bypass duplicate state branches (Top-down).",
              problems: ["LeetCode 509: Fibonacci Memo version"],
              snippet: `def fib_memo(n, memo={}):
    if n in memo: return memo[n]
    if n <= 1: return n
    memo[n] = fib_memo(n-1) + fib_memo(n-2)
    return memo[n]`
            },
            {
              id: "dp-opt-tab",
              name: "Tabulation",
              isPattern: true,
              difficulty: "Easy",
              desc: "Builds optimal parameters iteratively bottom-up in arrays (Tabulation).",
              problems: ["LeetCode 70: Climbing Stairs Tabulation"],
              snippet: `def climb_tab(n):
    dp = [0, 1, 2] # base instances
    for i in range(3, n+1): dp.append(dp[-1] + dp[-2])
    return dp[n]`
            }
          ]
        }
      ]
    },
    {
      id: "greedy",
      name: "GREEDY",
      color: "#D946EF", // Bright Purple
      children: [
        {
          name: "Interval Greedy",
          children: [
            {
              id: "grd-int-act",
              name: "Activity Selection",
              isPattern: true,
              difficulty: "Easy",
              desc: "Sorts intervals by their end times, always selecting the earliest ending activity to maximize schedule count.",
              problems: ["LeetCode 435: Non-overlapping Intervals"],
              snippet: `def activity_select(intervals):
    intervals.sort(key=lambda x: x[1])
    cnt = 1; end = intervals[0][1]
    for s, e in intervals[1:]:
        if s >= end: cnt += 1; end = e
    return cnt`
            },
            {
              id: "grd-int-nonoverlap",
              name: "Non-overlapping Intervals",
              isPattern: true,
              difficulty: "Medium",
              desc: "Sorts intervals by end times to locate and remove overlapping boundaries.",
              problems: ["LeetCode 435: Non-overlapping Intervals (Removals version)"],
              snippet: `def erase_overlap(intervals):
    if not intervals: return 0
    intervals.sort(key=lambda x: x[1])
    end = intervals[0][1]; del_cnt = 0
    for s, e in intervals[1:]:
        if s < end: del_cnt += 1
        else: end = e
    return del_cnt`
            },
            {
              id: "grd-int-rem",
              name: "Minimum Removals",
              isPattern: true,
              difficulty: "Medium",
              desc: "Greedily strips overlapping subsegments by comparing current boundaries against maximum overlapping limits.",
              problems: ["LeetCode 452: Minimum Arrows to Burst Balloons"],
              snippet: `def find_min_arrows(points):
    if not points: return 0
    points.sort(key=lambda x: x[1])
    arrows = 1; end = points[0][1]
    for s, e in points[1:]:
        if s > end: arrows += 1; end = e
    return arrows`
            }
          ]
        },
        {
          name: "Scheduling Greedy",
          children: [
            {
              id: "grd-sch-dead",
              name: "Deadline Based Scheduling",
              isPattern: true,
              difficulty: "Medium",
              desc: "Schedules elements on latest possible empty slots matching deadlines to avoid profit gaps.",
              problems: ["GeeksforGeeks: Job Sequencing Problem"],
              snippet: `def job_sequence(jobs, t):
    # jobs: [(id, deadline, profit)] sorted by profit desc
    pass`
            },
            {
              id: "grd-sch-profit",
              name: "Profit Based Selection",
              isPattern: true,
              difficulty: "Medium",
              desc: "Picks high profit elements dynamically, resolving deadline overlap gaps using heaps.",
              problems: ["LeetCode 630: Course Schedule III"],
              snippet: `import heapq
def schedule_courses(courses):
    courses.sort(key=lambda x: x[1])
    heap = []; time = 0
    for duration, end in courses:
        time += duration
        heapq.heappush(heap, -duration)
        if time > end: time += heapq.heappop(heap)
    return len(heap)`
            }
          ]
        },
        {
          name: "Resource Allocation",
          children: [
            {
              id: "grd-res-plat",
              name: "Minimum Platforms / Rooms",
              isPattern: true,
              difficulty: "Medium",
              desc: "Tracks arrivals and departures systematically to count maximum active overlapping intervals.",
              problems: ["LeetCode 253: Meeting Rooms II", "GeeksforGeeks: Minimum Platforms"],
              snippet: `def find_platforms(arr, dep):
    arr.sort(); dep.sort()
    p_needed = max_p = 1
    i = 1; j = 0
    while i < len(arr) and j < len(dep):
        if arr[i] <= dep[j]:
            p_needed += 1; i += 1
        else:
            p_needed -= 1; j += 1
        max_p = max(max_p, p_needed)
    return max_p`
            },
            {
              id: "grd-res-meet",
              name: "Meeting Rooms",
              isPattern: true,
              difficulty: "Easy",
              desc: "Validates meeting compatibility by sorting start times and checking for overlaps.",
              problems: ["LeetCode 252: Meeting Rooms"],
              snippet: `def can_attend(intervals):
    intervals.sort()
    for i in range(len(intervals)-1):
        if intervals[i][1] > intervals[i+1][0]: return False
    return True`
            }
          ]
        },
        {
          id: "grd-jump",
          name: "Jump Game Pattern",
          isPattern: true,
          difficulty: "Medium",
          desc: "Greedily tracks the furthest index reachable at each position to solve traversal availability.",
          problems: ["LeetCode 55: Jump Game", "LeetCode 45: Jump Game II"],
          snippet: `def can_jump(nums):
    max_reach = 0
    for i, jump in enumerate(nums):
        if i > max_reach: return False
        max_reach = max(max_reach, i + jump)
    return True`
        },
        {
          id: "grd-huff",
          name: "Huffman / Merge Cost",
          isPattern: true,
          difficulty: "Medium",
          desc: "Greedily connects two shortest elements using heaps to minimize total merge cost.",
          problems: ["GeeksforGeeks: Minimum Cost to Connect Ropes"],
          snippet: `import heapq
def min_rope_cost(ropes):
    heapq.heapify(ropes)
    cost = 0
    while len(ropes) > 1:
        first, second = heapq.heappop(ropes), heapq.heappop(ropes)
        comb = first + second; cost += comb
        heapq.heappush(ropes, comb)
    return cost`
        }
      ]
    },
    {
      id: "bitmanipulation",
      name: "BIT MANIPULATION",
      color: "#3B82F6", // Bright Blue
      children: [
        {
          name: "Core",
          children: [
            {
              id: "bit-core-xor",
              name: "XOR Pattern",
              isPattern: true,
              difficulty: "Easy",
              desc: "Uses XOR self-inverse logic (X ^ X = 0) to cancel out duplicates.",
              problems: ["LeetCode 136: Single Number"],
              snippet: `def single_number(nums):
    xor = 0
    for x in nums: xor ^= x
    return xor`
            },
            {
              id: "bit-core-mask",
              name: "Bit Masking",
              isPattern: true,
              difficulty: "Easy",
              desc: "Applies bitwise masks to set, clear, or check specific bits.",
              problems: ["LeetCode 190: Reverse Bits"],
              snippet: `def reverse_bits(n):
    res = 0
    for _ in range(32):
        res = (res << 1) | (n & 1)
        n >>= 1
    return res`
            }
          ]
        },
        {
          name: "Usage",
          children: [
            {
              id: "bit-use-subset",
              name: "Subset via Bits",
              isPattern: true,
              difficulty: "Medium",
              desc: "Generates power subsets by mapping bit patterns (0 to 2^N - 1) directly to elements indexes.",
              problems: ["LeetCode 78: Subsets using bits"],
              snippet: `def subsets_bits(nums):
    n = len(nums)
    res = []
    for mask in range(1 << n):
        subset = []
        for i in range(n):
            if mask & (1 << i): subset.append(nums[i])
        res.append(subset)
    return res`
            },
            {
              id: "bit-use-checks",
              name: "Bit Checks",
              isPattern: true,
              difficulty: "Easy",
              desc: "Uses bitwise checks (e.g. n & (n - 1)) to validate number properties in O(1) time.",
              problems: ["LeetCode 231: Power of Two", "LeetCode 191: Number of 1 Bits"],
              snippet: `def is_power_of_two(n):
    return n > 0 and (n & (n - 1)) == 0`
            },
            {
              id: "bit-use-prexor",
              name: "Prefix XOR",
              isPattern: true,
              difficulty: "Medium",
              desc: "Precomputes prefix XOR parameters to support constant range XOR sweeps.",
              problems: ["LeetCode 1310: XOR Queries"],
              snippet: `def prefix_xor(arr):
    prefix = [0]
    for x in arr: prefix.append(prefix[-1] ^ x)
    return prefix`
            }
          ]
        }
      ]
    },
    {
      id: "sorting",
      name: "Sorting Algorithms",
      color: "#475569", // Dark Grey
      children: [
        {
          id: "srt-bubble",
          name: "Bubble Sort",
          isPattern: true,
          difficulty: "Easy",
          desc: "Repeatedly swaps adjacent elements if they are out of order. Ideal for educational analysis. O(N^2) complexity.",
          problems: ["GeeksforGeeks: Bubble Sort"],
          snippet: `def bubble_sort(arr):
    n = len(arr)
    for i in range(n):
        swapped = False
        for j in range(0, n - i - 1):
            if arr[j] > arr[j + 1]:
                arr[j], arr[j + 1] = arr[j + 1], arr[j]
                swapped = True
        if not swapped: break`
        },
        {
          id: "srt-select",
          name: "Selection Sort",
          isPattern: true,
          difficulty: "Easy",
          desc: "Iteratively finds the minimum element in unsorted sections and places it at the starting sorted index. O(N^2) complexity.",
          problems: ["GeeksforGeeks: Selection Sort"],
          snippet: `def selection_sort(arr):
    n = len(arr)
    for i in range(n):
        min_idx = i
        for j in range(i + 1, n):
            if arr[j] < arr[min_idx]: min_idx = j
        arr[i], arr[min_idx] = arr[min_idx], arr[i]`
        },
        {
          id: "srt-insert",
          name: "Insertion Sort",
          isPattern: true,
          difficulty: "Easy",
          desc: "Inserts unsorted elements into their correct position in a growing sorted section. O(N^2) complexity.",
          problems: ["GeeksforGeeks: Insertion Sort"],
          snippet: `def insertion_sort(arr):
    for i in range(1, len(arr)):
        key = arr[i]
        j = i - 1
        while j >= 0 and arr[j] > key:
            arr[j + 1] = arr[j]
            j -= 1
        arr[j + 1] = key`
        },
        {
          id: "srt-merge",
          name: "Merge Sort",
          isPattern: true,
          difficulty: "Medium",
          desc: "Guarantees stable O(N log N) sorting using a divide-and-conquer strategy to split and merge sub-arrays.",
          problems: ["LeetCode 912: Sort an Array (Merge Sort)"],
          snippet: `def merge_sort(arr):
    if len(arr) <= 1: return arr
    mid = len(arr) // 2
    l = merge_sort(arr[:mid])
    r = merge_sort(arr[mid:])
    # merge logic...
    pass`
        },
        {
          id: "srt-quick",
          name: "Quick Sort",
          isPattern: true,
          difficulty: "Medium",
          desc: "Sorts in-place in O(N log N) average time by partitioning smaller/larger values around a pivot index.",
          problems: ["LeetCode 912: Sort an Array (Quick Sort)"],
          snippet: `def quicksort(arr):
    if len(arr) <= 1: return arr
    pivot = arr[len(arr) // 2]
    l = [x for x in arr if x < pivot]
    m = [x for x in arr if x == pivot]
    r = [x for x in arr if x > pivot]
    return quicksort(l) + m + quicksort(r)`
        },
        {
          id: "srt-heap",
          name: "Heap Sort",
          isPattern: true,
          difficulty: "Medium",
          desc: "Sorts elements in O(N log N) in-place time by loading items into a binary heap and pulling root elements.",
          problems: ["LeetCode 912: Heap Sort version"],
          snippet: `import heapq
def heap_sort(arr):
    heapq.heapify(arr)
    return [heapq.heappop(arr) for _ in range(len(arr))]`
        },
        {
          id: "srt-counting",
          name: "Counting Sort",
          isPattern: true,
          difficulty: "Medium",
          desc: "Achieves linear O(N + K) sorting by counting occurrences of each unique value, suitable for small positive integer bounds.",
          problems: ["LeetCode 75: Sort Colors (Counting)"],
          snippet: `def counting_sort(arr):
    counts = [0] * (max(arr) + 1)
    for x in arr: counts[x] += 1
    res = []
    for val, cnt in enumerate(counts): res.extend([val]*cnt)
    return res`
        },
        {
          id: "srt-radix",
          name: "Radix Sort",
          isPattern: true,
          difficulty: "Hard",
          desc: "Sorts integers digit-by-digit from LSB to MSB in O(D * (N + B)) time using counting sort as a stable base.",
          problems: ["LeetCode 164: Maximum Gap (Radix Sort)"],
          snippet: `def radix_sort(arr):
    # stable sorting digit-by-digit from least to most significant
    pass`
        },
        {
          id: "srt-bucket",
          name: "Bucket Sort",
          isPattern: true,
          difficulty: "Medium",
          desc: "Distributes elements uniformly into buckets, sorts them individually, and aggregates them back in linear average time.",
          problems: ["LeetCode 347: Bucket Sort version"],
          snippet: `def bucket_sort(arr):
    # splits elements evenly across list buckets
    pass`
        }
      ]
    },
    {
      id: "rangestructures",
      name: "RANGE STRUCTURES",
      color: "#0D9488", // Mint Teal
      children: [
        {
          name: "Segment Tree",
          children: [
            {
              id: "rng-seg-query",
              name: "Range Query",
              isPattern: true,
              difficulty: "Hard",
              desc: "Executes range sum or range minimum queries inside segment trees in O(log N) time.",
              problems: ["LeetCode 307: Range Sum Query - Mutable"],
              snippet: `class SegmentTree:
    def __init__(self, arr):
        self.n = len(arr)
        self.tree = [0]*(4*self.n)
        self.build(arr, 0, 0, self.n - 1)
    def build(self, arr, idx, l, r):
        if l == r:
            self.tree[idx] = arr[l]; return
        mid = (l + r) // 2
        self.build(arr, 2*idx+1, l, mid)
        self.build(arr, 2*idx+2, mid+1, r)
        self.tree[idx] = self.tree[2*idx+1] + self.tree[2*idx+2]`
            },
            {
              id: "rng-seg-lazy",
              name: "Lazy Propagation",
              isPattern: true,
              difficulty: "Hard",
              desc: "Optimizes range updates to O(log N) inside segment trees by deferring updates until queried.",
              problems: ["Codeforces: Range Updates Lazy Propagation"],
              snippet: `def update_range(node, l, r, ql, qr, val):
    # propagates lazy additions down during traversal checks
    pass`
            }
          ]
        },
        {
          name: "Fenwick Tree",
          children: [
            {
              id: "rng-fen-prefix",
              name: "Prefix Query",
              isPattern: true,
              difficulty: "Hard",
              desc: "Maintains prefix sums inside flat index arrays, updating and querying sums in O(log N) using LSB index shifts.",
              problems: ["LeetCode 307: Range Sum (BIT version)", "LeetCode 315: Count Smaller Numbers After Self"],
              snippet: `class BIT:
    def __init__(self, size):
        self.tree = [0]*(size + 1)
    def update(self, idx, val):
        while idx < len(self.tree):
            self.tree[idx] += val
            idx += idx & (-idx)
    def query(self, idx):
        s = 0
        while idx > 0:
            s += self.tree[idx]
            idx -= idx & (-idx)
        return s`
            }
          ]
        }
      ]
    }
  ]
};
